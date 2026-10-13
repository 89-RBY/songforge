import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { AccountError, deleteAccount, exportAccount } from "@/server/account/service";
import type { AudioStorage } from "@/server/storage/types";
import { canUseTestDb, createTestDb, resetTables } from "../helpers/db";

// Records which audio keys were removed, so the test can check the order and the set.
class RecordingStorage implements AudioStorage {
  deleted: string[] = [];
  failNext = false;
  async put(): Promise<void> {}
  async get(): Promise<null> {
    return null;
  }
  async delete(key: string): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("storage non raggiungibile");
    }
    this.deleted.push(key);
  }
}

describe.skipIf(!canUseTestDb)("account deletion and export (database)", () => {
  let db: PrismaClient;
  let storage: RecordingStorage;
  let userId: string;
  let email: string;

  beforeAll(() => {
    db = createTestDb();
  });

  afterAll(async () => {
    await resetTables(db);
    await db.auditLog.deleteMany();
    await db.$disconnect();
  });

  beforeEach(async () => {
    await resetTables(db);
    await db.auditLog.deleteMany();
    storage = new RecordingStorage();
    email = `addio-${Math.random().toString(36).slice(2)}@test.it`;
    const user = await db.user.create({ data: { email, name: "Anna", creditBalance: 7 } });
    userId = user.id;
    await db.song.create({
      data: { userId, providerId: "mock", durationMode: "CLIP", prompt: "prima canzone di prova", status: "READY", audioKey: "songs/a.wav", mimeType: "audio/wav", shareToken: "t".repeat(32) },
    });
    await db.song.create({
      data: { userId, providerId: "mock", durationMode: "CLIP", prompt: "seconda canzone di prova", status: "FAILED" },
    });
    await db.creditEntry.create({ data: { userId, amount: 10, balanceAfter: 10, reason: "SIGNUP_BONUS", referenceKey: `signup:${userId}` } });
  });

  it("exports the profile, songs and credit history, without audio or share tokens", async () => {
    const data = await exportAccount(db, userId);
    expect(data.profile).toMatchObject({ email, name: "Anna", creditBalance: 7 });
    expect(data.songs).toHaveLength(2);
    expect(data.creditHistory).toHaveLength(1);

    const text = JSON.stringify(data);
    expect(text).not.toContain("songs/a.wav");
    expect(text).not.toContain("shareToken");
    expect(text).not.toContain("t".repeat(32));
  });

  it("refuses to delete without the exact account email, and deletes nothing", async () => {
    await expect(deleteAccount(db, storage, userId, "altra@test.it")).rejects.toMatchObject({ code: "CONFIRM_MISMATCH" });
    expect(await db.user.count({ where: { id: userId } })).toBe(1);
    expect(storage.deleted).toEqual([]);
  });

  it("accepts the email in any letter case", async () => {
    await deleteAccount(db, storage, userId, email.toUpperCase());
    expect(await db.user.count({ where: { id: userId } })).toBe(0);
  });

  it("refuses while a song is still being generated", async () => {
    await db.song.create({ data: { userId, providerId: "mock", durationMode: "CLIP", prompt: "in corso adesso", status: "GENERATING" } });
    const error = await deleteAccount(db, storage, userId, email).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AccountError);
    expect((error as AccountError).code).toBe("SONGS_IN_PROGRESS");
    expect(await db.user.count({ where: { id: userId } })).toBe(1);
  });

  it("removes the account, its songs and audio, keeps the credit history without a user, and logs the action", async () => {
    await deleteAccount(db, storage, userId, email);

    expect(storage.deleted).toEqual(["songs/a.wav"]);
    expect(await db.user.count({ where: { id: userId } })).toBe(0);
    expect(await db.song.count({ where: { userId } })).toBe(0);
    expect(await db.job.count()).toBe(0);
    const history = await db.creditEntry.findMany({ where: { reason: "SIGNUP_BONUS" } });
    expect(history).toHaveLength(1);
    expect(history[0]!.userId).toBeNull();
    expect(await db.auditLog.count({ where: { action: "ACCOUNT_DELETED", targetId: userId } })).toBe(1);
  });

  it("keeps everything when the audio cannot be removed, so the user can retry", async () => {
    storage.failNext = true;
    await expect(deleteAccount(db, storage, userId, email)).rejects.toThrow("storage");
    expect(await db.user.count({ where: { id: userId } })).toBe(1);
    expect(await db.song.count({ where: { userId } })).toBe(2);

    await deleteAccount(db, storage, userId, email);
    expect(await db.user.count({ where: { id: userId } })).toBe(0);
  });
});
