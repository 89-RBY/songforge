import { getEnv } from "@/server/config/env";
import { LocalAudioStorage } from "./local";
import { S3AudioStorage } from "./s3";
import { S3Client } from "@aws-sdk/client-s3";
import type { AudioStorage } from "./types";

let cached: AudioStorage | undefined;

export function getAudioStorage(): AudioStorage {
  if (cached) return cached;
  const env = getEnv();
  if (env.STORAGE_DRIVER === "local") {
    cached = new LocalAudioStorage(env.STORAGE_LOCAL_DIR);
  } else {
    const client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: Boolean(env.S3_ENDPOINT),
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      },
    });
    cached = new S3AudioStorage(client, env.S3_BUCKET!);
  }
  return cached;
}
