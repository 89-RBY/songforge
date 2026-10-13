import { getEnv, type Env } from "@/server/config/env";
import { ClaudeLyricsProvider } from "./claude";
import { MockLyricsProvider } from "./mock";
import type { LyricsProvider } from "./types";

type LyricsEnv = Pick<Env, "ANTHROPIC_API_KEY" | "LYRICS_MODEL" | "MOCK_PROVIDER">;

// Claude when a key is configured; the mock in development; otherwise no lyrics service (null).
export function createLyricsProvider(env: LyricsEnv): LyricsProvider | null {
  if (env.ANTHROPIC_API_KEY) {
    return new ClaudeLyricsProvider({ apiKey: env.ANTHROPIC_API_KEY, model: env.LYRICS_MODEL });
  }
  if (env.MOCK_PROVIDER) return new MockLyricsProvider();
  return null;
}

export function getLyricsProvider(): LyricsProvider | null {
  return createLyricsProvider(getEnv());
}
