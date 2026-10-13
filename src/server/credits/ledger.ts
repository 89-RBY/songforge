import type { CreditReason, Prisma, PrismaClient } from "@/generated/prisma/client";
import { getPricing } from "@/server/pricing/settings";

export type Tx = Prisma.TransactionClient;

export class InsufficientCreditsError extends Error {
  constructor() {
    super("Crediti insufficienti");
    this.name = "InsufficientCreditsError";
  }
}

export type CreditPost = {
  userId: string;
  // Positive adds credits, negative spends them.
  amount: number;
  reason: CreditReason;
  songId?: string;
  // Unique per event (a webhook session, a refund). A second post with the same key changes nothing.
  referenceKey?: string;
  note?: string;
  priceCents?: number;
};

export type CreditPostResult = { applied: boolean; balance: number };

// Must run inside a transaction (tx). The user row lock serialises every balance change of one user,
// so two spends can never both see the same balance.
export async function postCredits(tx: Tx, post: CreditPost): Promise<CreditPostResult> {
  if (!Number.isInteger(post.amount) || post.amount === 0) {
    throw new Error("Importo crediti non valido");
  }

  const [user] = await tx.$queryRaw<{ creditBalance: number }[]>`
    SELECT "creditBalance" FROM "User" WHERE id = ${post.userId} FOR UPDATE
  `;
  if (!user) throw new Error(`Utente non trovato per il ledger: ${post.userId}`);

  if (post.referenceKey) {
    // Read after the lock: a concurrent post with the same key has either committed or waits for us.
    const existing = await tx.creditEntry.findUnique({
      where: { referenceKey: post.referenceKey },
      select: { id: true },
    });
    if (existing) return { applied: false, balance: user.creditBalance };
  }

  const balance = user.creditBalance + post.amount;
  if (balance < 0) throw new InsufficientCreditsError();

  await tx.user.update({ where: { id: post.userId }, data: { creditBalance: balance } });
  await tx.creditEntry.create({
    data: {
      userId: post.userId,
      amount: post.amount,
      balanceAfter: balance,
      reason: post.reason,
      songId: post.songId,
      referenceKey: post.referenceKey,
      note: post.note,
      priceCents: post.priceCents,
    },
  });
  return { applied: true, balance };
}

// Gives back the credits of a song that failed. Runs in the same transaction as the FAILED status,
// so a song is never marked failed without its refund (or refunded twice).
export async function refundFailedSong(tx: Tx, songId: string): Promise<CreditPostResult | null> {
  const song = await tx.song.findUnique({
    where: { id: songId },
    select: { userId: true, creditCost: true },
  });
  if (!song || song.creditCost <= 0) return null;
  return postCredits(tx, {
    userId: song.userId,
    amount: song.creditCost,
    reason: "REFUND",
    songId,
    referenceKey: `refund:${songId}`,
    note: "Generazione non riuscita",
  });
}

// Signup bonus, granted once per user (the referenceKey makes a repeated call a no-op).
export async function grantSignupBonus(db: PrismaClient, userId: string): Promise<void> {
  const { signupCredits } = await getPricing(db);
  if (signupCredits <= 0) return;
  await db.$transaction((tx) =>
    postCredits(tx, {
      userId,
      amount: signupCredits,
      reason: "SIGNUP_BONUS",
      referenceKey: `signup:${userId}`,
      note: "Crediti di benvenuto",
    }),
  );
}
