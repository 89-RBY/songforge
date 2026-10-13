import { NextResponse } from "next/server";
import type { PrismaClient } from "@/generated/prisma/client";
import { consumeLimit, type LimitRule } from "./limiter";

export type LimitCheck = { rule: LimitRule; subject: string };

// Returns the number of seconds to wait when a limit is reached, or null when every check passes.
// Checks run in order and stop at the first refusal.
export async function checkLimits(db: PrismaClient, checks: LimitCheck[]): Promise<number | null> {
  for (const { rule, subject } of checks) {
    const result = await consumeLimit(db, rule, subject);
    if (!result.allowed) return result.retryAfterSeconds;
  }
  return null;
}

export function rateLimitedResponse(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { error: "RATE_LIMITED" },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}
