import type { PrismaClient } from "@/generated/prisma/client";

export type ClaimedJob = {
  id: string;
  kind: string;
  songId: string | null;
  attempts: number;
  maxAttempts: number;
};

// A job locked for longer than this is considered abandoned (the worker crashed).
// It must stay above the longest provider timeout (LYRIA_TIMEOUT_MS, 10 minutes by default).
const STALE_LOCK_MINUTES = 15;

export function retryDelayMs(attempt: number): number {
  return Math.min(30_000 * 2 ** Math.max(0, attempt - 1), 15 * 60_000);
}

// Atomic claim. SKIP LOCKED lets several workers pull jobs at the same time without waiting on each other.
export async function claimNextJob(db: PrismaClient, workerId: string): Promise<ClaimedJob | null> {
  const rows = await db.$queryRaw<ClaimedJob[]>`
    UPDATE "Job"
    SET status = 'RUNNING',
        "lockedAt" = now(),
        "lockedBy" = ${workerId},
        attempts = attempts + 1,
        "updatedAt" = now()
    WHERE id = (
      SELECT id FROM "Job"
      WHERE (status = 'PENDING' AND "runAt" <= now())
         OR (status = 'RUNNING' AND "lockedAt" < now() - make_interval(mins => ${STALE_LOCK_MINUTES}))
      ORDER BY "runAt"
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, kind, "songId", attempts, "maxAttempts"
  `;
  return rows[0] ?? null;
}

export async function completeJob(db: PrismaClient, jobId: string): Promise<void> {
  await db.job.update({
    where: { id: jobId },
    data: { status: "DONE", lockedAt: null, lockedBy: null },
  });
}

// Returns RETRY when the job goes back to the queue with a delay, FAILED when it is final.
export async function failJob(
  db: PrismaClient,
  job: ClaimedJob,
  message: string,
  { retryable }: { retryable: boolean },
): Promise<"RETRY" | "FAILED"> {
  if (retryable && job.attempts < job.maxAttempts) {
    await db.job.update({
      where: { id: job.id },
      data: {
        status: "PENDING",
        runAt: new Date(Date.now() + retryDelayMs(job.attempts)),
        lockedAt: null,
        lockedBy: null,
        lastError: message,
      },
    });
    return "RETRY";
  }
  await db.job.update({
    where: { id: job.id },
    data: { status: "FAILED", lockedAt: null, lockedBy: null, lastError: message },
  });
  return "FAILED";
}
