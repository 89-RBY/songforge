import os from "node:os";
import { getEnv } from "@/server/config/env";
import { getDb } from "@/server/db";
import { processNextJob } from "@/server/jobs/process";
import { getMusicProviders } from "@/server/music/registry";
import { getAudioStorage } from "@/server/storage";

// Long-running process, separate from the web app. Run with: npm run worker
async function main(): Promise<void> {
  const env = getEnv(); // fail fast on invalid configuration
  const workerId = `${os.hostname()}:${process.pid}`;
  let stopping = false;

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      stopping = true;
      console.info(`[worker] ${signal} ricevuto: termino il job corrente e mi fermo`);
    });
  }

  const db = getDb();
  const deps = {
    db,
    providers: getMusicProviders(),
    storage: getAudioStorage(),
    workerId,
  };

  console.info(
    `[worker] avviato come ${workerId}, provider attivi: ${deps.providers.map((p) => p.id).join(", ") || "nessuno"}`,
  );

  while (!stopping) {
    let worked = false;
    try {
      worked = await processNextJob(deps);
    } catch (error) {
      console.error("[worker] errore non gestito:", error);
    }
    if (!worked) {
      await new Promise((resolve) => setTimeout(resolve, env.WORKER_POLL_MS));
    }
  }

  await db.$disconnect();
  console.info("[worker] fermato");
}

main().catch((error) => {
  console.error("[worker] avvio non riuscito:", error);
  process.exit(1);
});
