import { getEnv } from "@/server/config/env";

// Behind the reverse proxy (Caddy) the client address is the last entry of X-Forwarded-For: the proxy appends it,
// and anything before it can be forged by the client. Without a trusted proxy no address is used, so the
// per-address limits are skipped rather than shared by every visitor.
export function clientIp(headers: Headers, trustProxy: boolean = getEnv().TRUST_PROXY): string | null {
  if (!trustProxy) return null;
  const forwarded = headers.get("x-forwarded-for");
  if (!forwarded) return null;
  const last = forwarded.split(",").pop()?.trim();
  return last || null;
}
