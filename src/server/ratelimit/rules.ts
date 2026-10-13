import type { LimitRule } from "./limiter";

// Limits per person (account) and per address. The address limit is generous: it stops floods from one
// network without blocking a whole office or a mobile carrier's shared address too early.
export const RULES = {
  songsPerUser: { name: "songs:user", limit: 20, windowSeconds: 60 * 60 },
  songsPerIp: { name: "songs:ip", limit: 60, windowSeconds: 60 * 60 },
  lyricsPerUser: { name: "lyrics:user", limit: 30, windowSeconds: 60 * 60 },
  checkoutPerUser: { name: "checkout:user", limit: 10, windowSeconds: 60 * 60 },
  magicLinkPerEmail: { name: "magic:email", limit: 5, windowSeconds: 15 * 60 },
  magicLinkPerIp: { name: "magic:ip", limit: 20, windowSeconds: 15 * 60 },
} satisfies Record<string, LimitRule>;
