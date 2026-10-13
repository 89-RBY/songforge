import type { PrismaClient } from "@/generated/prisma/client";
import { refundFailedSong } from "@/server/credits/ledger";
import { completeJob, failJob, type ClaimedJob } from "@/server/jobs/queue";
import { findProvider } from "@/server/music/registry";
import { ProviderError, type MusicProvider } from "@/server/music/types";
import { extensionForMimeType, type AudioStorage } from "@/server/storage/types";

// Messages shown to the user. Internal details go to Job.lastError, never here.
export const USER_MESSAGES: Record<string, string> = {
  BLOCKED: "Il servizio musicale non ha accettato questa richiesta. Prova a cambiare il testo o lo stile.",
  RATE_LIMITED: "Troppe richieste in questo momento. Riprova tra qualche minuto.",
  TIMEOUT: "La generazione ha impiegato troppo tempo. Riprova.",
  UPSTREAM: "Il servizio musicale non è raggiungibile. Riprova.",
  INVALID_RESPONSE: "Il servizio musicale ha risposto in modo inatteso. Riprova.",
  PROVIDER_UNAVAILABLE: "Il modello scelto non è disponibile al momento.",
};

export type GenerateDeps = {
  db: PrismaClient;
  providers: MusicProvider[];
  storage: AudioStorage;
};

// One transaction for the job, the song status and the refund: a failed song is always refunded, and only once.
async function recordFailure(
  deps: GenerateDeps,
  job: ClaimedJob,
  songId: string,
  code: string,
  detail: string,
  retryable: boolean,
): Promise<void> {
  await deps.db.$transaction(async (tx) => {
    const outcome = await failJob(tx, job, `${code}: ${detail}`, { retryable });
    if (outcome === "RETRY") {
      await tx.song.update({ where: { id: songId }, data: { status: "QUEUED", errorCode: code } });
      return;
    }
    await tx.song.update({
      where: { id: songId },
      data: { status: "FAILED", errorCode: code, errorMessage: USER_MESSAGES[code] ?? USER_MESSAGES.UPSTREAM },
    });
    await refundFailedSong(tx, songId);
  });
}

// Idempotent: a job that runs again after a crash finds the song already READY and only closes the job.
export async function generateSong(deps: GenerateDeps, job: ClaimedJob): Promise<void> {
  const { db } = deps;
  if (!job.songId) {
    await failJob(db, job, "Job senza canzone associata", { retryable: false });
    return;
  }

  const song = await db.song.findUnique({ where: { id: job.songId } });
  if (!song || song.status === "READY") {
    await completeJob(db, job.id);
    return;
  }

  const provider = findProvider(deps.providers, song.providerId);
  if (!provider) {
    await recordFailure(deps, job, song.id, "PROVIDER_UNAVAILABLE", `provider ${song.providerId} non attivo`, false);
    return;
  }

  await db.song.update({ where: { id: song.id }, data: { status: "GENERATING" } });

  try {
    const audio = await provider.generate({
      prompt: song.prompt,
      lyrics: song.lyrics ?? undefined,
      instrumental: song.instrumental,
      durationMode: song.durationMode,
    });

    const key = `songs/${song.id}.${extensionForMimeType(audio.mimeType)}`;
    await deps.storage.put(key, audio.data);

    await db.song.update({
      where: { id: song.id },
      data: {
        status: "READY",
        audioKey: key,
        mimeType: audio.mimeType,
        durationSeconds: audio.durationSeconds,
        generatedLyrics: audio.lyrics,
        errorCode: null,
        errorMessage: null,
        completedAt: new Date(),
      },
    });
    await completeJob(db, job.id);
  } catch (error) {
    // Provider errors carry their own retry policy. Anything else (storage, database) is treated as transient.
    if (error instanceof ProviderError) {
      await recordFailure(deps, job, song.id, error.code, error.message, error.retryable);
    } else {
      const message = error instanceof Error ? error.message : String(error);
      await recordFailure(deps, job, song.id, "UPSTREAM", message, true);
    }
  }
}
