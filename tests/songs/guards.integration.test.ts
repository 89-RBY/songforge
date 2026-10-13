import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { processNextJob } from "@/server/jobs/process";
import type { PromptClassifier } from "@/server/moderation/classifier";
import { DEFAULT_PRICING, savePricing } from "@/server/pricing/settings";
import { LocalAudioStorage } from "@/server/storage/local";
import { createSong, SongServiceError } from "@/server/songs/service";
import { canUseTestDb, createTestDb, resetTables } from "../helpers/db";
import { MockProvider } from "@/server/music/providers/mock";

// Priced like the real clip (4 cents) and free of any real call.
class PricedMock extends MockProvider {
  override estimateCostCents(): number {
    return 4;
  }
}

const input = {
  prompt: "ballata acustica sulla pioggia e sul ritorno a casa",
  durationMode: "CLIP" as const,
  providerId: "mock",
};

const allowAll: PromptClassifier = { classify: async () => ({ allowed: true }) };

describe.skipIf(!canUseTestDb)("song guards (database)", () => {
  let db: PrismaClient;
  let root: string;
  let userId: string;

  beforeAll(async () => {
    db = createTestDb();
    root = await mkdtemp(path.join(tmpdir(), "songforge-guards-"));
  });

  afterAll(async () => {
    await resetTables(db);
    await db.$disconnect();
    await rm(root, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await resetTables(db);
    const user = await db.user.create({
      data: { email: `guardie-${Math.random().toString(36).slice(2)}@test.it`, creditBalance: 100 },
    });
    userId = user.id;
  });

  const deps = (extra: { classifier?: PromptClassifier | null } = {}) => ({
    db,
    providers: [new PricedMock(0)],
    ...extra,
  });

  it("stops new paid songs once the daily cap is reached", async () => {
    await savePricing(db, { ...DEFAULT_PRICING, dailyApiCapCents: 5 });
    await createSong(deps({ classifier: allowAll }), userId, input);

    await expect(createSong(deps({ classifier: allowAll }), userId, { ...input, prompt: "un'altra canzone di prova" })).rejects.toMatchObject({
      code: "DAILY_CAP_REACHED",
    });
    expect(await db.song.count({ where: { userId } })).toBe(1);
    expect(await db.user.findUniqueOrThrow({ where: { id: userId } })).toMatchObject({ creditBalance: 99 });
  });

  it("has no cap when the daily limit is set to zero", async () => {
    await savePricing(db, { ...DEFAULT_PRICING, dailyApiCapCents: 0 });
    await createSong(deps({ classifier: allowAll }), userId, input);
    await createSong(deps({ classifier: allowAll }), userId, { ...input, prompt: "seconda canzone senza tetto" });
    expect(await db.song.count({ where: { userId } })).toBe(2);
  });

  it("refuses a request the classifier blocks, and creates nothing", async () => {
    const blocking: PromptClassifier = { classify: async () => ({ allowed: false, category: "HATE" }) };
    const error = await createSong(deps({ classifier: blocking }), userId, input).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SongServiceError);
    expect((error as SongServiceError).code).toBe("MODERATION_BLOCKED");
    expect(await db.song.count()).toBe(0);
    expect(await db.job.count()).toBe(0);
    expect(await db.user.findUniqueOrThrow({ where: { id: userId } })).toMatchObject({ creditBalance: 100 });
  });

  it("fails closed when the classifier cannot answer", async () => {
    const broken: PromptClassifier = { classify: async () => Promise.reject(new Error("rete")) };
    await expect(createSong(deps({ classifier: broken }), userId, input)).rejects.toMatchObject({
      code: "MODERATION_UNAVAILABLE",
    });
    expect(await db.song.count()).toBe(0);
  });

  it("works without a classifier, with only the local checks", async () => {
    const song = await createSong(deps({ classifier: null }), userId, input);
    expect(song.status).toBe("QUEUED");
  });

  it("keeps the daily count of failed songs too, since their cost was already committed", async () => {
    await savePricing(db, { ...DEFAULT_PRICING, dailyApiCapCents: 5 });
    await createSong(deps({ classifier: allowAll }), userId, input);
    await db.song.updateMany({ data: { status: "FAILED" } });
    await expect(createSong(deps({ classifier: allowAll }), userId, { ...input, prompt: "terza prova con il tetto" })).rejects.toMatchObject({
      code: "DAILY_CAP_REACHED",
    });
  });

  it("is unaffected by a successful run of the worker", async () => {
    await createSong(deps({ classifier: allowAll }), userId, input);
    const worker = { db, providers: [new PricedMock(0)], storage: new LocalAudioStorage(root), workerId: "t" };
    await processNextJob(worker);
    expect((await db.song.findFirstOrThrow({ where: { userId } })).status).toBe("READY");
  });
});
