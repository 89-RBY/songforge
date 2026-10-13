import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { PrismaClient } from "@/generated/prisma/client";
import { processNextJob } from "@/server/jobs/process";
import { MockProvider } from "@/server/music/providers/mock";
import { ProviderError, type DurationMode, type GeneratedAudio, type MusicProvider } from "@/server/music/types";
import { DEFAULT_PRICING, savePricing } from "@/server/pricing/settings";
import { LocalAudioStorage } from "@/server/storage/local";
import { createSong } from "@/server/songs/service";
import { canUseTestDb, createTestDb, resetTables } from "../helpers/db";

// Priced like the real provider: a clip costs 4 cents, a song 8 cents.
class PricedStub implements MusicProvider {
  readonly id = "stub";
  readonly label = "Stub";
  readonly capabilities = { durations: ["CLIP", "SONG"] as readonly DurationMode[], imageInput: false };

  constructor(private readonly behaviour: () => Promise<GeneratedAudio>) {}

  estimateCostCents(durationMode: DurationMode): number {
    return durationMode === "SONG" ? 8 : 4;
  }

  generate(): Promise<GeneratedAudio> {
    return this.behaviour();
  }
}

const input = {
  prompt: "rock energico con chitarre distorte per la festa di compleanno",
  durationMode: "CLIP" as const,
  providerId: "stub",
};

describe.skipIf(!canUseTestDb)("song charges and refunds (database)", () => {
  let db: PrismaClient;
  let root: string;
  let userId: string;

  beforeAll(async () => {
    db = createTestDb();
    root = await mkdtemp(path.join(tmpdir(), "songforge-credits-"));
  });

  afterAll(async () => {
    await resetTables(db);
    await db.$disconnect();
    await rm(root, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await resetTables(db);
    const user = await db.user.create({
      data: { email: `crediti-${Math.random().toString(36).slice(2)}@test.it`, creditBalance: 5 },
    });
    userId = user.id;
  });

  const deps = (providers: MusicProvider[]) => ({ db, providers });
  const worker = (providers: MusicProvider[]) => ({
    db,
    providers,
    storage: new LocalAudioStorage(root),
    workerId: "test-worker",
  });
  const balance = async () =>
    (await db.user.findUniqueOrThrow({ where: { id: userId }, select: { creditBalance: true } })).creditBalance;
  const stub = (behaviour: () => Promise<GeneratedAudio>) => new PricedStub(behaviour);
  const ok = (): Promise<GeneratedAudio> =>
    Promise.resolve({ data: new Uint8Array([0x52, 0x49, 0x46, 0x46]), mimeType: "audio/wav", durationSeconds: 5 });

  it("charges the credits of a clip and stores the cost on the song", async () => {
    const song = await createSong(deps([stub(ok)]), userId, input);
    expect(await balance()).toBe(4);
    expect(song).toMatchObject({ apiCostCents: 4, creditCost: 1 });

    const entry = await db.creditEntry.findUniqueOrThrow({ where: { referenceKey: `generation:${song.id}` } });
    expect(entry).toMatchObject({ amount: -1, balanceAfter: 4, reason: "GENERATION", songId: song.id });
  });

  it("charges a full song at its own price", async () => {
    const song = await createSong(deps([stub(ok)]), userId, { ...input, durationMode: "SONG" });
    expect(song.creditCost).toBe(2);
    expect(await balance()).toBe(3);
  });

  it("creates nothing when the balance is too low", async () => {
    await db.user.update({ where: { id: userId }, data: { creditBalance: 0 } });
    await expect(createSong(deps([stub(ok)]), userId, input)).rejects.toMatchObject({
      code: "INSUFFICIENT_CREDITS",
    });
    expect(await db.song.count({ where: { userId } })).toBe(0);
    expect(await db.job.count()).toBe(0);
    expect(await balance()).toBe(0);
  });

  it("charges nothing for a free provider", async () => {
    const song = await createSong(deps([new MockProvider(0)]), userId, { ...input, providerId: "mock" });
    expect(song.creditCost).toBe(0);
    expect(await balance()).toBe(5);
    expect(await db.creditEntry.count()).toBe(0);
  });

  it("refuses a provider disabled in the settings", async () => {
    await savePricing(db, { ...DEFAULT_PRICING, disabledProviders: ["stub"] });
    await expect(createSong(deps([stub(ok)]), userId, input)).rejects.toMatchObject({ code: "INVALID_PROVIDER" });
    expect(await balance()).toBe(5);
  });

  it("refunds a song that fails for good", async () => {
    const song = await createSong(deps([stub(ok)]), userId, input);
    expect(await balance()).toBe(4);

    const blocked = stub(() => Promise.reject(new ProviderError("BLOCKED", "prompt rifiutato")));
    await processNextJob(worker([blocked]));

    const failed = await db.song.findUniqueOrThrow({ where: { id: song.id } });
    expect(failed.status).toBe("FAILED");
    expect(await balance()).toBe(5);
    expect(await db.creditEntry.count({ where: { songId: song.id, reason: "REFUND" } })).toBe(1);
  });

  it("keeps the charge while a failed job is retried, and refunds only at the end", async () => {
    const song = await createSong(deps([stub(ok)]), userId, input);
    const upstream = stub(() => Promise.reject(new ProviderError("UPSTREAM", "rete")));

    await processNextJob(worker([upstream]));
    expect((await db.song.findUniqueOrThrow({ where: { id: song.id } })).status).toBe("QUEUED");
    expect(await balance()).toBe(4);

    // Make the retry available now, then exhaust the attempts.
    await db.job.updateMany({ data: { runAt: new Date(0) } });
    await db.job.updateMany({ where: { songId: song.id }, data: { attempts: 2 } });
    await processNextJob(worker([upstream]));

    expect((await db.song.findUniqueOrThrow({ where: { id: song.id } })).status).toBe("FAILED");
    expect(await balance()).toBe(5);
  });

  it("keeps the charge when the song succeeds", async () => {
    const song = await createSong(deps([stub(ok)]), userId, input);
    await processNextJob(worker([stub(ok)]));
    expect((await db.song.findUniqueOrThrow({ where: { id: song.id } })).status).toBe("READY");
    expect(await balance()).toBe(4);
    expect(await db.creditEntry.count({ where: { reason: "REFUND" } })).toBe(0);
  });
});
