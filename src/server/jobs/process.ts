import { claimNextJob, failJob } from "./queue";
import { generateSong, type GenerateDeps } from "@/server/songs/generate";

export type WorkerDeps = GenerateDeps & { workerId: string };

// Claims one job and runs it. Returns false when the queue is empty.
export async function processNextJob(deps: WorkerDeps): Promise<boolean> {
  const job = await claimNextJob(deps.db, deps.workerId);
  if (!job) return false;

  try {
    if (job.kind === "generate_song") {
      await generateSong(deps, job);
    } else {
      await failJob(deps.db, job, `Tipo di job sconosciuto: ${job.kind}`, { retryable: false });
    }
  } catch (error) {
    // Failure outside the provider call (for example the database is down): retry the job later.
    const message = error instanceof Error ? error.message : String(error);
    await failJob(deps.db, job, `ERRORE_WORKER: ${message}`, { retryable: true });
  }
  return true;
}
