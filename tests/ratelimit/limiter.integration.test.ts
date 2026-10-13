import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { consumeLimit, purgeRateLimits } from "@/server/ratelimit/limiter";
import { canUseTestDb, createTestDb } from "../helpers/db";

describe.skipIf(!canUseTestDb)("rate limiter (database)", () => {
  let db: PrismaClient;
  const subject = () => `s-${Math.random().toString(36).slice(2)}`;

  beforeAll(() => {
    db = createTestDb();
  });

  afterAll(async () => {
    await db.rateLimit.deleteMany();
    await db.$disconnect();
  });

  beforeEach(async () => {
    await db.rateLimit.deleteMany();
  });

  it("allows up to the limit and refuses the next request with a retry time", async () => {
    const rule = { name: "test:basic", limit: 3, windowSeconds: 600 };
    const id = subject();
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await consumeLimit(db, rule, id));

    expect(results.map((result) => result.allowed)).toEqual([true, true, true, false]);
    const refused = results[3]!;
    expect(refused.retryAfterSeconds).toBeGreaterThan(0);
    expect(refused.retryAfterSeconds).toBeLessThanOrEqual(600);
  });

  it("counts each subject separately", async () => {
    const rule = { name: "test:separate", limit: 1, windowSeconds: 600 };
    expect((await consumeLimit(db, rule, subject())).allowed).toBe(true);
    expect((await consumeLimit(db, rule, subject())).allowed).toBe(true);
  });

  it("never lets more than the limit through under parallel requests", async () => {
    const rule = { name: "test:parallel", limit: 4, windowSeconds: 600 };
    const id = subject();
    const results = await Promise.all(Array.from({ length: 12 }, () => consumeLimit(db, rule, id)));
    expect(results.filter((result) => result.allowed)).toHaveLength(4);
  });

  it("starts a new window once the previous one has ended", async () => {
    const rule = { name: "test:window", limit: 1, windowSeconds: 1 };
    const id = subject();
    expect((await consumeLimit(db, rule, id)).allowed).toBe(true);
    expect((await consumeLimit(db, rule, id)).allowed).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect((await consumeLimit(db, rule, id)).allowed).toBe(true);
  });

  it("removes counters whose window ended long ago", async () => {
    const old = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await db.rateLimit.create({ data: { key: "old:1", count: 9, windowStart: old } });
    await consumeLimit(db, { name: "test:recent", limit: 5, windowSeconds: 600 }, subject());

    expect(await purgeRateLimits(db, 24)).toBe(1);
    expect(await db.rateLimit.count({ where: { key: "old:1" } })).toBe(0);
    expect(await db.rateLimit.count({ where: { key: { startsWith: "test:recent:" } } })).toBe(1);
  });
});
