import type { PrismaClient } from "@/generated/prisma/client";
import type { AudioStorage } from "@/server/storage/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 100;

// Removes audio older than the retention period. The song stays in the library, marked as purged,
// so the user knows why it has no audio any more. Returns how many songs were purged.
export async function purgeExpiredAudio(deps: {
  db: PrismaClient;
  storage: AudioStorage;
  now: Date;
  retentionDays: number;
}): Promise<number> {
  const cutoff = new Date(deps.now.getTime() - deps.retentionDays * DAY_MS);
  const songs = await deps.db.song.findMany({
    where: { status: "READY", audioKey: { not: null }, audioPurgedAt: null, completedAt: { lt: cutoff } },
    select: { id: true, audioKey: true },
    take: BATCH_SIZE,
  });

  for (const song of songs) {
    if (song.audioKey) await deps.storage.delete(song.audioKey);
    await deps.db.song.update({
      where: { id: song.id },
      data: { audioPurgedAt: deps.now, audioKey: null },
    });
  }
  return songs.length;
}
