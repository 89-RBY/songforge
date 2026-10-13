import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { getAdminMetrics, startOfUtcDay } from "@/server/admin/metrics";
import { AdminActionError, adjustCredits, getUserDetail, listRecentFailures, listUsers, setBlocked } from "@/server/admin/users";
import { canUseTestDb, createTestDb, resetTables } from "../helpers/db";

describe.skipIf(!canUseTestDb)("admin panel (database)", () => {
  let db: PrismaClient;
  let adminId: string;
  let targetId: string;

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
    const suffix = Math.random().toString(36).slice(2);
    adminId = (await db.user.create({ data: { email: `admin-${suffix}@test.it`, role: "ADMIN" } })).id;
    targetId = (await db.user.create({ data: { email: `Mario.Rossi-${suffix}@test.it`, name: "Mario", creditBalance: 10 } })).id;
  });

  const balance = async (id: string) =>
    (await db.user.findUniqueOrThrow({ where: { id }, select: { creditBalance: true } })).creditBalance;

  describe("metrics", () => {
    it("adds up songs, sales, spend and errors of the period", async () => {
      const now = new Date();
      await db.song.create({
        data: { userId: targetId, providerId: "lyria", durationMode: "SONG", prompt: "canzone completata", status: "READY", apiCostCents: 8, creditCost: 2, completedAt: now },
      });
      await db.song.create({
        data: { userId: targetId, providerId: "lyria", durationMode: "CLIP", prompt: "canzone non riuscita", status: "FAILED", errorCode: "BLOCKED", apiCostCents: 4, creditCost: 1 },
      });
      await db.creditEntry.create({
        data: { userId: targetId, amount: 100, balanceAfter: 110, reason: "PURCHASE", priceCents: 900 },
      });
      await db.creditEntry.create({
        data: { userId: targetId, amount: -2, balanceAfter: 108, reason: "GENERATION", referenceKey: "generation:x" },
      });

      const metrics = await getAdminMetrics(db, now);
      expect(metrics).toMatchObject({
        songs30: 2,
        ready30: 1,
        failed30: 1,
        activeUsers30: 1,
        totalUsers: 2,
        blockedUsers: 0,
        revenueCents30: 900,
        creditsSold30: 100,
        apiCostCents30: 8,
        creditsSpent30: 2,
        apiSpendTodayCents: 12,
      });
      expect(metrics.errors7).toEqual([{ code: "BLOCKED", count: 1 }]);
    });

    it("counts only the last 30 days for sales and songs", async () => {
      const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      await db.song.create({
        data: { userId: targetId, providerId: "lyria", durationMode: "CLIP", prompt: "canzone vecchia", status: "READY", apiCostCents: 4, creditCost: 1, completedAt: old, createdAt: old },
      });
      await db.creditEntry.create({ data: { userId: targetId, amount: 50, balanceAfter: 60, reason: "PURCHASE", priceCents: 500, createdAt: old } });

      const metrics = await getAdminMetrics(db);
      expect(metrics.songs30).toBe(0);
      expect(metrics.revenueCents30).toBe(0);
      expect(metrics.apiCostCents30).toBe(0);
    });

    it("starts the daily window at UTC midnight", () => {
      expect(startOfUtcDay(new Date("2026-10-13T23:59:00Z")).toISOString()).toBe("2026-10-13T00:00:00.000Z");
    });
  });

  describe("users", () => {
    it("blocks and unblocks another user, recording each change", async () => {
      await setBlocked(db, adminId, targetId, { blocked: true });
      expect((await db.user.findUniqueOrThrow({ where: { id: targetId } })).blocked).toBe(true);

      await setBlocked(db, adminId, targetId, { blocked: false });
      expect((await db.user.findUniqueOrThrow({ where: { id: targetId } })).blocked).toBe(false);

      const actions = await db.auditLog.findMany({ where: { targetId }, orderBy: { createdAt: "asc" }, select: { action: true, actorId: true } });
      expect(actions).toEqual([
        { action: "USER_BLOCKED", actorId: adminId },
        { action: "USER_UNBLOCKED", actorId: adminId },
      ]);
    });

    it("does not let an admin block their own account", async () => {
      await expect(setBlocked(db, adminId, adminId, { blocked: true })).rejects.toMatchObject({ code: "CANNOT_BLOCK_SELF" });
      expect((await db.user.findUniqueOrThrow({ where: { id: adminId } })).blocked).toBe(false);
    });

    it("reports an unknown user instead of changing anything", async () => {
      await expect(setBlocked(db, adminId, "utente-inesistente", { blocked: true })).rejects.toBeInstanceOf(AdminActionError);
      await expect(adjustCredits(db, adminId, "utente-inesistente", { amount: 5, note: "prova" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("rejects an invalid block payload", async () => {
      await expect(setBlocked(db, adminId, targetId, { blocked: "sì" })).rejects.toBeInstanceOf(ZodError);
    });

    it("adjusts credits through the ledger with a reason and an audit row", async () => {
      expect(await adjustCredits(db, adminId, targetId, { amount: 15, note: "Compensazione per errore" })).toBe(25);
      expect(await adjustCredits(db, adminId, targetId, { amount: -5, note: "Correzione doppio accredito" })).toBe(20);
      expect(await balance(targetId)).toBe(20);

      const entries = await db.creditEntry.findMany({ where: { userId: targetId, reason: "ADMIN_ADJUST" }, orderBy: { createdAt: "asc" } });
      expect(entries.map((entry) => [entry.amount, entry.balanceAfter, entry.note])).toEqual([
        [15, 25, "Compensazione per errore"],
        [-5, 20, "Correzione doppio accredito"],
      ]);
      expect(await db.auditLog.count({ where: { action: "CREDITS_ADJUSTED", targetId } })).toBe(2);
    });

    it("refuses an adjustment that would make the balance negative", async () => {
      await expect(adjustCredits(db, adminId, targetId, { amount: -11, note: "troppo" })).rejects.toMatchObject({
        code: "BALANCE_NEGATIVE",
      });
      expect(await balance(targetId)).toBe(10);
      expect(await db.creditEntry.count({ where: { userId: targetId, reason: "ADMIN_ADJUST" } })).toBe(0);
    });

    it("rejects zero, huge and unexplained adjustments", async () => {
      await expect(adjustCredits(db, adminId, targetId, { amount: 0, note: "nulla" })).rejects.toBeInstanceOf(ZodError);
      await expect(adjustCredits(db, adminId, targetId, { amount: 20_000, note: "troppo grande" })).rejects.toBeInstanceOf(ZodError);
      await expect(adjustCredits(db, adminId, targetId, { amount: 5, note: "" })).rejects.toBeInstanceOf(ZodError);
      expect(await balance(targetId)).toBe(10);
    });

    it("searches by email or name, ignoring case", async () => {
      const byEmail = await listUsers(db, "mario.rossi");
      expect(byEmail.map((user) => user.id)).toEqual([targetId]);
      const byName = await listUsers(db, "MARIO");
      expect(byName.map((user) => user.id)).toEqual([targetId]);
      expect(await listUsers(db, "nessuno-così")).toEqual([]);
    });

    it("returns the detail of a user with song count and recent ledger", async () => {
      await db.song.create({ data: { userId: targetId, providerId: "mock", durationMode: "CLIP", prompt: "canzone di prova" } });
      const detail = await getUserDetail(db, targetId);
      expect(detail).toMatchObject({ songCount: 1, user: { id: targetId, creditBalance: 10 } });
      expect(await getUserDetail(db, "utente-inesistente")).toBeNull();
    });

    it("lists failures without the prompt", async () => {
      await db.song.create({
        data: { userId: targetId, providerId: "lyria", durationMode: "CLIP", prompt: "testo segreto del prompt", status: "FAILED", errorCode: "UPSTREAM", errorMessage: "Il servizio non risponde." },
      });
      const failures = await listRecentFailures(db);
      expect(failures).toHaveLength(1);
      expect(failures[0]).toMatchObject({ errorCode: "UPSTREAM", user: { email: expect.stringContaining("Mario") } });
      expect(Object.keys(failures[0]!)).not.toContain("prompt");
    });
  });
});
