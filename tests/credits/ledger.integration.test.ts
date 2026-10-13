import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { grantSignupBonus, InsufficientCreditsError, postCredits, refundFailedSong } from "@/server/credits/ledger";
import { DEFAULT_PRICING, savePricing } from "@/server/pricing/settings";
import { canUseTestDb, createTestDb, resetTables } from "../helpers/db";

describe.skipIf(!canUseTestDb)("credit ledger (database)", () => {
  let db: PrismaClient;
  let userId: string;

  beforeAll(() => {
    db = createTestDb();
  });

  afterAll(async () => {
    await resetTables(db);
    await db.$disconnect();
  });

  beforeEach(async () => {
    await resetTables(db);
    const user = await db.user.create({ data: { email: `ledger-${Math.random().toString(36).slice(2)}@test.it` } });
    userId = user.id;
  });

  const post = (amount: number, referenceKey?: string) =>
    db.$transaction((tx) => postCredits(tx, { userId, amount, reason: "ADMIN_ADJUST", referenceKey }));

  const balance = async () =>
    (await db.user.findUniqueOrThrow({ where: { id: userId }, select: { creditBalance: true } })).creditBalance;

  it("adds and spends credits, keeping the balance on the user in step with the ledger", async () => {
    expect(await post(10)).toEqual({ applied: true, balance: 10 });
    expect(await post(-4)).toEqual({ applied: true, balance: 6 });

    expect(await balance()).toBe(6);
    const rows = await db.creditEntry.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
    expect(rows.map((row) => [row.amount, row.balanceAfter])).toEqual([
      [10, 10],
      [-4, 6],
    ]);
  });

  it("refuses to overdraw and changes nothing", async () => {
    await post(3);
    await expect(post(-5)).rejects.toBeInstanceOf(InsufficientCreditsError);
    expect(await balance()).toBe(3);
    expect(await db.creditEntry.count({ where: { userId } })).toBe(1);
  });

  it("refuses zero and fractional amounts", async () => {
    await expect(post(0)).rejects.toThrow();
    await expect(post(1.5)).rejects.toThrow();
  });

  it("applies a post with the same reference key only once", async () => {
    expect(await post(20, "purchase:1")).toEqual({ applied: true, balance: 20 });
    expect(await post(20, "purchase:1")).toEqual({ applied: false, balance: 20 });
    expect(await balance()).toBe(20);
  });

  it("never overdraws under concurrent spends", async () => {
    await post(5);
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => post(-1)));
    const succeeded = results.filter((result) => result.status === "fulfilled").length;
    expect(succeeded).toBe(5);
    expect(await balance()).toBe(0);
  });

  it("grants the signup bonus once, with the amount from the pricing settings", async () => {
    await grantSignupBonus(db, userId);
    await grantSignupBonus(db, userId);
    expect(await balance()).toBe(DEFAULT_PRICING.signupCredits);
    expect(await db.creditEntry.count({ where: { userId, reason: "SIGNUP_BONUS" } })).toBe(1);
  });

  it("grants no signup bonus when the operator sets it to zero", async () => {
    await savePricing(db, { ...DEFAULT_PRICING, signupCredits: 0 });
    await grantSignupBonus(db, userId);
    expect(await balance()).toBe(0);
    expect(await db.creditEntry.count({ where: { userId } })).toBe(0);
  });

  it("refunds a failed song once and skips songs that cost nothing", async () => {
    await post(10);
    const paid = await db.song.create({
      data: { userId, providerId: "lyria", durationMode: "SONG", prompt: "canzone di prova", status: "FAILED", creditCost: 2 },
    });
    const free = await db.song.create({
      data: { userId, providerId: "mock", durationMode: "CLIP", prompt: "canzone gratuita", status: "FAILED", creditCost: 0 },
    });

    expect(await db.$transaction((tx) => refundFailedSong(tx, free.id))).toBeNull();
    expect(await db.$transaction((tx) => refundFailedSong(tx, paid.id))).toEqual({ applied: true, balance: 12 });
    expect(await db.$transaction((tx) => refundFailedSong(tx, paid.id))).toEqual({ applied: false, balance: 12 });

    expect(await balance()).toBe(12);
    expect(await db.creditEntry.count({ where: { reason: "REFUND" } })).toBe(1);
  });
});
