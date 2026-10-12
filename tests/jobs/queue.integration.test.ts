import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { claimNextJob, completeJob, failJob, retryDelayMs } from "@/server/jobs/queue";
import { canUseTestDb, createTestDb, resetTables } from "../helpers/db";

describe("retryDelayMs", () => {
  it("doubles the delay from 30 seconds and caps it at 15 minutes", () => {
    expect(retryDelayMs(1)).toBe(30_000);
    expect(retryDelayMs(2)).toBe(60_000);
    expect(retryDelayMs(3)).toBe(120_000);
    expect(retryDelayMs(20)).toBe(15 * 60_000);
  });
});

describe.skipIf(!canUseTestDb)("job queue (database)", () => {
  let db: PrismaClient;

  beforeAll(() => {
    db = createTestDb();
  });

  beforeEach(async () => {
    await resetTables(db);
  });

  afterAll(async () => {
    await resetTables(db);
    await db.$disconnect();
  });

  it("claims the oldest due job, marks it RUNNING and counts the attempt", async () => {
    const older = await db.job.create({ data: { kind: "t", runAt: new Date(Date.now() - 60_000) } });
    await db.job.create({ data: { kind: "t", runAt: new Date(Date.now() - 30_000) } });

    const claimed = await claimNextJob(db, "worker-a");

    expect(claimed?.id).toBe(older.id);
    expect(claimed?.attempts).toBe(1);
    const row = await db.job.findUniqueOrThrow({ where: { id: older.id } });
    expect(row.status).toBe("RUNNING");
    expect(row.lockedBy).toBe("worker-a");
  });

  it("does not claim a job scheduled for later", async () => {
    await db.job.create({ data: { kind: "t", runAt: new Date(Date.now() + 60_000) } });
    expect(await claimNextJob(db, "worker-a")).toBeNull();
  });

  it("never gives the same job to two workers at the same time", async () => {
    await db.job.createMany({ data: [{ kind: "t" }, { kind: "t" }] });

    const [a, b] = await Promise.all([claimNextJob(db, "worker-a"), claimNextJob(db, "worker-b")]);

    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.id).not.toBe(b!.id);
  });

  it("reclaims a job whose lock is older than 15 minutes, as after a crash", async () => {
    const job = await db.job.create({
      data: {
        kind: "t",
        status: "RUNNING",
        attempts: 1,
        lockedBy: "crashed-worker",
        lockedAt: new Date(Date.now() - 60 * 60_000),
      },
    });

    const claimed = await claimNextJob(db, "worker-b");

    expect(claimed?.id).toBe(job.id);
    expect(claimed?.attempts).toBe(2);
  });

  it("does not steal a job whose lock is still fresh", async () => {
    await db.job.create({
      data: { kind: "t", status: "RUNNING", attempts: 1, lockedBy: "busy", lockedAt: new Date() },
    });
    expect(await claimNextJob(db, "worker-b")).toBeNull();
  });

  it("retries with a delay while attempts remain, then fails for good", async () => {
    const job = await db.job.create({ data: { kind: "t", maxAttempts: 2 } });

    const first = await claimNextJob(db, "worker-a");
    expect(await failJob(db, first!, "boom", { retryable: true })).toBe("RETRY");
    const afterFirst = await db.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(afterFirst.status).toBe("PENDING");
    expect(afterFirst.runAt.getTime()).toBeGreaterThan(Date.now());

    await db.job.update({ where: { id: job.id }, data: { runAt: new Date(0) } });
    const second = await claimNextJob(db, "worker-a");
    expect(second?.attempts).toBe(2);
    expect(await failJob(db, second!, "boom again", { retryable: true })).toBe("FAILED");
    const final = await db.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(final.status).toBe("FAILED");
    expect(final.lastError).toBe("boom again");
  });

  it("fails at once when the error is not retryable", async () => {
    await db.job.create({ data: { kind: "t" } });
    const claimed = await claimNextJob(db, "worker-a");
    expect(await failJob(db, claimed!, "bloccato", { retryable: false })).toBe("FAILED");
  });

  it("marks a finished job DONE and releases its lock", async () => {
    const job = await db.job.create({ data: { kind: "t" } });
    const claimed = await claimNextJob(db, "worker-a");
    await completeJob(db, claimed!.id);
    const row = await db.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(row.status).toBe("DONE");
    expect(row.lockedBy).toBeNull();
  });
});
