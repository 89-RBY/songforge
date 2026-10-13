import type { PrismaClient } from "@/generated/prisma/client";

export type LimitRule = {
  name: string;
  limit: number;
  windowSeconds: number;
};

export type LimitResult = { allowed: boolean; retryAfterSeconds: number };

// One atomic statement per call: the row lock of the upsert serialises concurrent requests for the same key,
// so the count is exact even under parallel load.
export async function consumeLimit(db: PrismaClient, rule: LimitRule, subject: string): Promise<LimitResult> {
  const key = `${rule.name}:${subject}`;
  const rows = await db.$queryRaw<{ count: number; windowStart: Date; now: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart")
    VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimit"."windowStart" <= now() - make_interval(secs => ${rule.windowSeconds}) THEN 1
        ELSE "RateLimit"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "RateLimit"."windowStart" <= now() - make_interval(secs => ${rule.windowSeconds}) THEN now()
        ELSE "RateLimit"."windowStart"
      END
    RETURNING "count", "windowStart", now() AS "now"
  `;
  const row = rows[0];
  if (!row) throw new Error("Contatore di rate limit non aggiornato");

  const allowed = row.count <= rule.limit;
  const windowEndMs = row.windowStart.getTime() + rule.windowSeconds * 1000;
  const retryAfterSeconds = Math.max(1, Math.ceil((windowEndMs - row.now.getTime()) / 1000));
  return { allowed, retryAfterSeconds };
}

// Removes counters whose window ended long ago. Called by the worker.
export async function purgeRateLimits(db: PrismaClient, olderThanHours = 24): Promise<number> {
  const result = await db.$executeRaw`DELETE FROM "RateLimit" WHERE "windowStart" < now() - make_interval(hours => ${olderThanHours})`;
  return Number(result);
}
