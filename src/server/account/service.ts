import type { PrismaClient } from "@/generated/prisma/client";
import { recordAudit } from "@/server/admin/audit";
import type { AudioStorage } from "@/server/storage/types";

export type AccountErrorCode = "NOT_FOUND" | "CONFIRM_MISMATCH" | "SONGS_IN_PROGRESS";

export class AccountError extends Error {
  constructor(
    readonly code: AccountErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AccountError";
  }
}

// Everything the user has in SongForge, in a readable form. Audio is left out: it is large and can be downloaded
// from the library. The share token is left out too: it is a credential for the public link.
export async function exportAccount(db: PrismaClient, userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, createdAt: true, creditBalance: true },
  });
  if (!user) throw new AccountError("NOT_FOUND", "Account non trovato");

  const [songs, history] = await Promise.all([
    db.song.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: {
        title: true,
        status: true,
        providerId: true,
        durationMode: true,
        prompt: true,
        lyrics: true,
        generatedLyrics: true,
        mood: true,
        energy: true,
        genre: true,
        favorite: true,
        createdAt: true,
        completedAt: true,
      },
    }),
    db.creditEntry.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { amount: true, balanceAfter: true, reason: true, note: true, priceCents: true, createdAt: true },
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    profile: { email: user.email, name: user.name, createdAt: user.createdAt, creditBalance: user.creditBalance },
    songs,
    creditHistory: history,
  };
}

// Deletes the account and its songs. Audio goes first: if storage fails, nothing is removed and the user can retry.
// Credit history stays without a user (ledger rows keep their amounts for tax records).
export async function deleteAccount(db: PrismaClient, storage: AudioStorage, userId: string, confirmEmail: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
  if (!user) throw new AccountError("NOT_FOUND", "Account non trovato");
  if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
    throw new AccountError("CONFIRM_MISMATCH", "L'email non corrisponde al tuo account");
  }

  const inProgress = await db.song.count({ where: { userId, status: { in: ["QUEUED", "GENERATING"] } } });
  if (inProgress > 0) {
    throw new AccountError("SONGS_IN_PROGRESS", "Attendi la fine delle canzoni in lavorazione");
  }

  const withAudio = await db.song.findMany({
    where: { userId, audioKey: { not: null } },
    select: { audioKey: true },
  });
  for (const song of withAudio) {
    if (song.audioKey) await storage.delete(song.audioKey);
  }

  await db.$transaction(async (tx) => {
    await recordAudit(tx, userId, "ACCOUNT_DELETED", userId);
    await tx.user.delete({ where: { id: userId } });
  });
}
