import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getEnv } from "@/server/config/env";

const globalForDb = globalThis as typeof globalThis & { songforgeDb?: PrismaClient };

// Created on first use, not at import time, so the build does not need DATABASE_URL.
export function getDb(): PrismaClient {
  if (!globalForDb.songforgeDb) {
    const adapter = new PrismaPg({ connectionString: getEnv().DATABASE_URL });
    globalForDb.songforgeDb = new PrismaClient({ adapter });
  }
  return globalForDb.songforgeDb;
}
