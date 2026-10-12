import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ZodError } from "zod";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { processNextJob } from "@/server/jobs/process";
import { MockProvider } from "@/server/music/providers/mock";
import { ProviderError, type DurationMode, type GeneratedAudio, type MusicProvider } from "@/server/music/types";
import { LocalAudioStorage } from "@/server/storage/local";
import { USER_MESSAGES } from "@/server/songs/generate";
import { createSong, MAX_ACTIVE_SONGS_PER_USER, SongServiceError } from "@/server/songs/service";
import { canUseTestDb, createTestDb, resetTables } from "../helpers/db";

// Scripted provider: each call runs the next behaviour, so tests can simulate failures and recovery.
class StubProvider implements MusicProvider {
  readonly id = "stub";
  readonly label = "Stub";
  readonly capabilities: { durations: readonly DurationMode[]; imageInput: boolean };
  calls = 0;

  constructor(
    private readonly behaviours: Array<() => Promise<GeneratedAudio>>,
    durations: readonly DurationMode[] = ["CLIP", "SONG"],
  ) {
    this.capabilities = { durations, imageInput: false };
  }

  estimateCostCents(): number {
    return 0;
  }

  async generate(): Promise<GeneratedAudio> {
    const next = this.behaviours[Math.min(this.calls, this.behaviours.length - 1)];
    this.calls++;
    return next();
  }
}

const ok = (): Promise<GeneratedAudio> =>
  Promise.resolve({ data: new Uint8Array([0x52, 0x49, 0x46, 0x46]), mimeType: "audio/wav", durationSeconds: 5 });

const failWith = (code: "BLOCKED" | "UPSTREAM") => () => Promise.reject(new ProviderError(code, `errore ${code}`));

const validInput = {
  prompt: "rock energico con chitarre distorte per la festa di compleanno",
  durationMode: "CLIP" as const,
  providerId: "mock",
};

describe("createSong input validation", () => {
  it("rejects a prompt shorter than 10 characters before any database access", async () => {
    await expect(
      createSong({ db: {} as PrismaClient, providers: [new MockProvider(0)] }, "u1", { ...validInput, prompt: "corta" }),
    ).rejects.toBeInstanceOf(ZodError);
  });
});

describe.skipIf(!canUseTestDb)("song generation (database)", () => {
  let db: PrismaClient;
  let root: string;
  let userId: string;

  beforeAll(async () => {
    db = createTestDb();
    root = await mkdtemp(path.join(tmpdir(), "songforge-songs-"));
  });

  beforeEach(async () => {
    await resetTables(db);
    const user = await db.user.create({ data: { email: `utente-${Math.random().toString(36).slice(2)}@test.it` } });
    userId = user.id;
  });

  afterAll(async () => {
    await resetTables(db);
    await db.$disconnect();
    await rm(root, { recursive: true, force: true });
  });

  const deps = (providers: MusicProvider[]) => ({ db, providers });
  const worker = (providers: MusicProvider[]) => ({
    db,
    providers,
    storage: new LocalAudioStorage(root),
    workerId: "test-worker",
  });

  it("creates a QUEUED song and a PENDING job linked to it", async () => {
    const song = await createSong(deps([new MockProvider(0)]), userId, validInput);

    expect(song.status).toBe("QUEUED");
    expect(song.title).toBe(validInput.prompt.slice(0, 57) + "...");
    const job = await db.job.findFirstOrThrow({ where: { songId: song.id } });
    expect(job.kind).toBe("generate_song");
    expect(job.status).toBe("PENDING");
  });

  it("refuses an unknown provider and creates nothing", async () => {
    await expect(createSong(deps([new MockProvider(0)]), userId, { ...validInput, providerId: "suno" })).rejects.toMatchObject({
      code: "INVALID_PROVIDER",
    });
    expect(await db.song.count()).toBe(0);
  });

  it("refuses a duration the provider does not support", async () => {
    const clipOnly = new StubProvider([ok], ["CLIP"]);
    await expect(
      createSong(deps([clipOnly]), userId, { ...validInput, providerId: "stub", durationMode: "SONG" }),
    ).rejects.toMatchObject({ code: "INVALID_PROVIDER" });
  });

  it("refuses a prompt that names a real artist and creates nothing", async () => {
    const attempt = createSong(deps([new MockProvider(0)]), userId, {
      ...validInput,
      prompt: "una canzone nello stile di Ligabue, con voce roca",
    });
    await expect(attempt).rejects.toBeInstanceOf(SongServiceError);
    await expect(attempt).rejects.toMatchObject({ code: "MODERATION_BLOCKED" });
    expect(await db.song.count()).toBe(0);
  });

  it("limits each user to a fixed number of songs in progress", async () => {
    const providers = [new MockProvider(0)];
    for (let i = 0; i < MAX_ACTIVE_SONGS_PER_USER; i++) {
      await createSong(deps(providers), userId, validInput);
    }
    await expect(createSong(deps(providers), userId, validInput)).rejects.toMatchObject({ code: "TOO_MANY_ACTIVE" });

    await db.song.updateMany({ where: { userId }, data: { status: "READY" } });
    await expect(createSong(deps(providers), userId, validInput)).resolves.toBeDefined();
  });

  it("holds the limit under parallel requests from the same user", async () => {
    const providers = [new MockProvider(0)];
    const results = await Promise.allSettled([
      createSong(deps(providers), userId, validInput),
      createSong(deps(providers), userId, validInput),
      createSong(deps(providers), userId, validInput),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(MAX_ACTIVE_SONGS_PER_USER);
    expect(await db.song.count({ where: { userId } })).toBe(MAX_ACTIVE_SONGS_PER_USER);
  });

  it("returns false when the queue is empty", async () => {
    expect(await processNextJob(worker([new MockProvider(0)]))).toBe(false);
  });

  it("generates the audio, stores it and marks the song READY", async () => {
    const providers = [new MockProvider(0)];
    const song = await createSong(deps(providers), userId, validInput);

    expect(await processNextJob(worker(providers))).toBe(true);

    const done = await db.song.findUniqueOrThrow({ where: { id: song.id } });
    expect(done.status).toBe("READY");
    expect(done.audioKey).toBe(`songs/${song.id}.wav`);
    expect(done.mimeType).toBe("audio/wav");
    expect(done.durationSeconds).toBe(5);
    expect(done.completedAt).not.toBeNull();

    const stored = await new LocalAudioStorage(root).get(done.audioKey!);
    expect(new TextDecoder().decode(stored!.data.slice(0, 4))).toBe("RIFF");
    expect((await db.job.findFirstOrThrow({ where: { songId: song.id } })).status).toBe("DONE");
  });

  it("marks the song FAILED at once when the provider blocks the request", async () => {
    const blocked = new StubProvider([failWith("BLOCKED")]);
    const song = await createSong(deps([blocked]), userId, { ...validInput, providerId: "stub" });

    await processNextJob(worker([blocked]));

    const failed = await db.song.findUniqueOrThrow({ where: { id: song.id } });
    expect(failed.status).toBe("FAILED");
    expect(failed.errorCode).toBe("BLOCKED");
    expect(failed.errorMessage).toBe(USER_MESSAGES.BLOCKED);
    const job = await db.job.findFirstOrThrow({ where: { songId: song.id } });
    expect(job.status).toBe("FAILED");
    expect(job.attempts).toBe(1);
    expect(blocked.calls).toBe(1);
  });

  it("retries a transient failure and succeeds on the next attempt", async () => {
    const flaky = new StubProvider([failWith("UPSTREAM"), ok]);
    const song = await createSong(deps([flaky]), userId, { ...validInput, providerId: "stub" });

    await processNextJob(worker([flaky]));
    const waiting = await db.song.findUniqueOrThrow({ where: { id: song.id } });
    expect(waiting.status).toBe("QUEUED");
    expect(waiting.errorCode).toBe("UPSTREAM");
    const job = await db.job.findFirstOrThrow({ where: { songId: song.id } });
    expect(job.status).toBe("PENDING");
    expect(job.runAt.getTime()).toBeGreaterThan(Date.now());

    await db.job.update({ where: { id: job.id }, data: { runAt: new Date(0) } });
    await processNextJob(worker([flaky]));

    const done = await db.song.findUniqueOrThrow({ where: { id: song.id } });
    expect(done.status).toBe("READY");
    expect(done.errorCode).toBeNull();
    expect(flaky.calls).toBe(2);
  });

  it("does not call the provider again for a song that is already READY", async () => {
    const providers = [new StubProvider([ok])];
    const song = await createSong(deps(providers), userId, { ...validInput, providerId: "stub" });
    await db.song.update({ where: { id: song.id }, data: { status: "READY" } });

    await processNextJob(worker(providers));

    expect(providers[0].calls).toBe(0);
    expect((await db.job.findFirstOrThrow({ where: { songId: song.id } })).status).toBe("DONE");
  });

  it("fails the song with PROVIDER_UNAVAILABLE when its provider is no longer configured", async () => {
    const song = await createSong(deps([new MockProvider(0)]), userId, validInput);

    await processNextJob(worker([]));

    const failed = await db.song.findUniqueOrThrow({ where: { id: song.id } });
    expect(failed.status).toBe("FAILED");
    expect(failed.errorCode).toBe("PROVIDER_UNAVAILABLE");
  });
});
