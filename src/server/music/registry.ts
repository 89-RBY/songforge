import { getEnv, type Env } from "@/server/config/env";
import { LyriaProvider } from "./providers/lyria";
import { MockProvider } from "./providers/mock";
import type { MusicProvider } from "./types";

type ProviderEnv = Pick<
  Env,
  "MOCK_PROVIDER" | "MOCK_DELAY_MS" | "MOCK_COST_CENTS" | "GEMINI_API_KEY" | "GEMINI_BASE_URL" | "LYRIA_SONG_MODEL" | "LYRIA_CLIP_MODEL" | "LYRIA_TIMEOUT_MS"
>;

// Only providers that are configured are returned, so the UI never offers a model that cannot run.
export function createProviders(env: ProviderEnv): MusicProvider[] {
  const providers: MusicProvider[] = [];
  if (env.MOCK_PROVIDER) providers.push(new MockProvider(env.MOCK_DELAY_MS, undefined, env.MOCK_COST_CENTS));
  if (env.GEMINI_API_KEY) {
    providers.push(
      new LyriaProvider({
        apiKey: env.GEMINI_API_KEY,
        baseUrl: env.GEMINI_BASE_URL,
        songModel: env.LYRIA_SONG_MODEL,
        clipModel: env.LYRIA_CLIP_MODEL,
        timeoutMs: env.LYRIA_TIMEOUT_MS,
      }),
    );
  }
  return providers;
}

export function getMusicProviders(): MusicProvider[] {
  return createProviders(getEnv());
}

export function findProvider(providers: readonly MusicProvider[], id: string): MusicProvider | undefined {
  return providers.find((provider) => provider.id === id);
}
