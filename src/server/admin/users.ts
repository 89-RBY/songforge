import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { InsufficientCreditsError, postCredits } from "@/server/credits/ledger";
import { recordAudit } from "./audit";

export type AdminErrorCode = "NOT_FOUND" | "CANNOT_BLOCK_SELF" | "BALANCE_NEGATIVE";

export class AdminActionError extends Error {
  constructor(
    readonly code: AdminErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AdminActionError";
  }
}

export const blockInput = z.object({ blocked: z.boolean() });

export const adjustInput = z.object({
  amount: z
    .number()
    .int()
    .min(-10_000)
    .max(10_000)
    .refine((value) => value !== 0, "L'importo non può essere zero"),
  note: z.string().trim().min(3).max(200),
});

export const LIST_LIMIT = 50;

export async function listUsers(db: PrismaClient, query: string | undefined) {
  const q = query?.trim();
  return db.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: LIST_LIMIT,
    select: { id: true, email: true, name: true, role: true, blocked: true, creditBalance: true, createdAt: true },
  });
}

export async function getUserDetail(db: PrismaClient, userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, blocked: true, creditBalance: true, createdAt: true },
  });
  if (!user) return null;
  const [songCount, ledger] = await Promise.all([
    db.song.count({ where: { userId } }),
    db.creditEntry.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, amount: true, balanceAfter: true, reason: true, createdAt: true },
    }),
  ]);
  return { user, songCount, ledger };
}

async function requireTarget(db: PrismaClient, targetId: string) {
  const user = await db.user.findUnique({ where: { id: targetId }, select: { id: true, blocked: true } });
  if (!user) throw new AdminActionError("NOT_FOUND", "Utente non trovato");
  return user;
}

export async function setBlocked(db: PrismaClient, actorId: string, targetId: string, rawInput: unknown) {
  const { blocked } = blockInput.parse(rawInput);
  if (actorId === targetId) {
    throw new AdminActionError("CANNOT_BLOCK_SELF", "Non puoi bloccare il tuo account");
  }
  const target = await requireTarget(db, targetId);
  if (target.blocked === blocked) return;

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: targetId }, data: { blocked } });
    await recordAudit(tx, actorId, blocked ? "USER_BLOCKED" : "USER_UNBLOCKED", targetId);
  });
}

// Manual credit change, recorded in the ledger (reason ADMIN_ADJUST) and in the audit log.
export async function adjustCredits(db: PrismaClient, actorId: string, targetId: string, rawInput: unknown): Promise<number> {
  const { amount, note } = adjustInput.parse(rawInput);
  await requireTarget(db, targetId);
  try {
    const result = await db.$transaction(async (tx) => {
      const posted = await postCredits(tx, { userId: targetId, amount, reason: "ADMIN_ADJUST", note });
      await recordAudit(tx, actorId, "CREDITS_ADJUSTED", targetId, { amount, note });
      return posted;
    });
    return result.balance;
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      throw new AdminActionError("BALANCE_NEGATIVE", "Il saldo non può scendere sotto zero");
    }
    throw error;
  }
}

export async function listRecentFailures(db: PrismaClient) {
  return db.song.findMany({
    where: { status: "FAILED" },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      userId: true,
      errorCode: true,
      errorMessage: true,
      providerId: true,
      durationMode: true,
      updatedAt: true,
      user: { select: { email: true } },
    },
  });
}
