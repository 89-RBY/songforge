import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { MockProvider } from "@/server/music/providers/mock";
import { purgeExpiredAudio } from "@/server/retention/purge";
import { LocalAudioStorage } from "@/server/storage/local";
import {
  createSong,
  createVariation,
  deleteSong,
  getSharedSong,
  setSharing,
  SongServiceError,
  updateSong,
} from "@/server/songs/service";
import { canUseTestDb, createTestDb, resetTables } from "../helpers/db";

const DAY = 24 * 60 * 60 * 1000;
const WAV = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3]);

describe.skipIf(!canUseTestDb)("library, sharing and retention (database)", () => {
  let db: PrismaClient;
  let root: string;
  let storage: LocalAudioStorage;
  let owner: string;
  let stranger: string;
  const providers = [new MockProvider(0)];

  beforeAll(async () => {
    db = createTestDb();
    root = await mkdtemp(path.join(tmpdir(), "songforge-library-"));
    storage = new LocalAudioStorage(root);
  });

  beforeEach(async () => {
    await resetTables(db);
    owner = (await db.user.create({ data: { email: `owner-${Math.random().toString(36).slice(2)}@test.it` } })).id;
    stranger = (await db.user.create({ data: { email: `stranger-${Math.random().toString(36).slice(2)}@test.it` } })).id;
  });

  afterAll(async () => {
    await resetTables(db);
    await db.$disconnect();
    await rm(root, { recursive: true, force: true });
  });

  // Creates a song and marks it READY with audio on disk, as the worker would.
  async function readySong(userId: string, patch: Record<string, unknown> = {}) {
    const song = await createSong(
      { db, providers },
      userId,
      { prompt: "rock energico con chitarre distorte per la festa", durationMode: "CLIP", providerId: "mock", ...patch },
    );
    const key = `songs/${song.id}.wav`;
    await storage.put(key, WAV);
    return db.song.update({
      where: { id: song.id },
      data: { status: "READY", audioKey: key, mimeType: "audio/wav", completedAt: new Date() },
    });
  }

  it("renames and favourites a song, and refuses an empty change", async () => {
    const song = await readySong(owner);

    const updated = await updateSong(db, owner, song.id, { title: "Nuovo titolo", favorite: true });
    expect(updated.title).toBe("Nuovo titolo");
    expect(updated.favorite).toBe(true);

    await expect(updateSong(db, owner, song.id, {})).rejects.toThrow();
  });

  it("hides other users' songs behind NOT_FOUND", async () => {
    const song = await readySong(owner);
    await expect(updateSong(db, stranger, song.id, { favorite: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteSong(db, storage, stranger, song.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("shares a ready song with a stable token, and revokes it", async () => {
    const song = await readySong(owner);

    const token = await setSharing(db, owner, song.id, true);
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(await setSharing(db, owner, song.id, true)).toBe(token);
    expect((await getSharedSong(db, token!))?.title).toBeDefined();

    await setSharing(db, owner, song.id, false);
    expect(await getSharedSong(db, token!)).toBeNull();
  });

  it("does not share a song that is still in progress", async () => {
    const song = await createSong({ db, providers }, owner, {
      prompt: "rock energico con chitarre distorte per la festa",
      durationMode: "CLIP",
      providerId: "mock",
    });
    await expect(setSharing(db, owner, song.id, true)).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("never returns a shared song for an unknown or malformed token", async () => {
    await readySong(owner);
    expect(await getSharedSong(db, "a".repeat(32))).toBeNull();
    expect(await getSharedSong(db, "../../etc/passwd")).toBeNull();
  });

  it("creates a variation that links to its source and changes one thing", async () => {
    const source = await readySong(owner, { lyrics: "[Verse]\nprima strofa" });

    const variation = await createVariation({ db, providers }, owner, source.id, { variation: "new_lyrics" });

    expect(variation.variationOf).toBe(source.id);
    expect(variation.title).toContain("(variante)");
    expect(variation.lyrics).toBeNull();
    expect(variation.prompt).toContain("Variation: keep the same style, but write completely new lyrics.");
  });

  it("refuses a variation of a song that is still generating", async () => {
    const song = await createSong({ db, providers }, owner, {
      prompt: "rock energico con chitarre distorte per la festa",
      durationMode: "CLIP",
      providerId: "mock",
    });
    await expect(createVariation({ db, providers }, owner, song.id, { variation: "more_energy" })).rejects.toBeInstanceOf(
      SongServiceError,
    );
  });

  it("deletes the row and the audio file, and refuses while the song is generating", async () => {
    const song = await readySong(owner);
    const file = path.join(root, song.audioKey!);
    expect((await stat(file)).isFile()).toBe(true);

    await deleteSong(db, storage, owner, song.id);

    expect(await db.song.findUnique({ where: { id: song.id } })).toBeNull();
    await expect(stat(file)).rejects.toThrow();

    const pending = await createSong({ db, providers }, owner, {
      prompt: "rock energico con chitarre distorte per la festa",
      durationMode: "CLIP",
      providerId: "mock",
    });
    await expect(deleteSong(db, storage, owner, pending.id)).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("purges audio older than the retention period but keeps the song", async () => {
    const old = await readySong(owner);
    const recent = await readySong(owner);
    const now = new Date();
    await db.song.update({ where: { id: old.id }, data: { completedAt: new Date(now.getTime() - 100 * DAY) } });

    const purged = await purgeExpiredAudio({ db, storage, now, retentionDays: 90 });

    expect(purged).toBe(1);
    const after = await db.song.findUniqueOrThrow({ where: { id: old.id } });
    expect(after.audioKey).toBeNull();
    expect(after.audioPurgedAt).not.toBeNull();
    expect((await db.song.findUniqueOrThrow({ where: { id: recent.id } })).audioPurgedAt).toBeNull();
    await expect(stat(path.join(root, old.id + ".wav"))).rejects.toThrow();
  });
});
