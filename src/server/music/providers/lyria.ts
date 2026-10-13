import { ProviderError, type DurationMode, type GeneratedAudio, type MusicProvider, type MusicRequest } from "../types";

export type LyriaOptions = {
  apiKey: string;
  baseUrl: string;
  songModel: string;
  clipModel: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
};

// List prices from the Gemini API pricing table: $0.08 per full song, $0.04 per 30-second clip.
const COST_CENTS: Record<DurationMode, number> = { SONG: 8, CLIP: 4 };

type LyriaPart = { text?: string; inlineData?: { mimeType?: string; data?: string } };
type LyriaCandidate = { finishReason?: string; content?: { parts?: LyriaPart[] } };
type LyriaResponse = {
  promptFeedback?: { blockReason?: string };
  candidates?: LyriaCandidate[];
};

const BLOCK_FINISH_REASONS = new Set(["PROHIBITED_CONTENT", "SAFETY", "BLOCKLIST", "SPII"]);

// The lyrics go into the text: the model reads them as part of the request.
export function textWithLyrics(request: MusicRequest): string {
  if (!request.lyrics) return request.prompt;
  return `${request.prompt}\n\nUse these lyrics, keeping the section labels in square brackets:\n${request.lyrics}`;
}

// Exported for tests. Accepts the documented shape; anything else is an invalid response.
export function parseLyriaResponse(payload: unknown): GeneratedAudio {
  const response = (payload ?? {}) as LyriaResponse;

  const blockReason = response.promptFeedback?.blockReason;
  if (blockReason) throw new ProviderError("BLOCKED", `Richiesta bloccata: ${blockReason}`);

  const candidate = response.candidates?.[0];
  if (candidate?.finishReason && BLOCK_FINISH_REASONS.has(candidate.finishReason)) {
    throw new ProviderError("BLOCKED", `Richiesta bloccata: ${candidate.finishReason}`);
  }

  const parts = candidate?.content?.parts ?? [];
  const audio = parts.find((part) => part.inlineData?.data && part.inlineData.mimeType?.startsWith("audio/"));
  if (!audio?.inlineData?.data || !audio.inlineData.mimeType) {
    throw new ProviderError("INVALID_RESPONSE", "Nessun audio nella risposta di Lyria");
  }

  const lyrics = parts
    .map((part) => part.text)
    .filter((text): text is string => Boolean(text))
    .join("\n")
    .trim();

  return {
    data: new Uint8Array(Buffer.from(audio.inlineData.data, "base64")),
    mimeType: audio.inlineData.mimeType,
    lyrics: lyrics || undefined,
  };
}

export class LyriaProvider implements MusicProvider {
  readonly id = "lyria";
  readonly label = "Google Lyria";
  readonly capabilities = { durations: ["CLIP", "SONG"] as const, imageInput: true };

  constructor(private readonly options: LyriaOptions) {}

  estimateCostCents(durationMode: DurationMode): number {
    return COST_CENTS[durationMode];
  }

  modelFor(durationMode: DurationMode): string {
    return durationMode === "CLIP" ? this.options.clipModel : this.options.songModel;
  }

  async generate(request: MusicRequest, options: { signal?: AbortSignal } = {}): Promise<GeneratedAudio> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const base = this.options.baseUrl.replace(/\/$/, "");
    const url = `${base}/v1beta/models/${encodeURIComponent(this.modelFor(request.durationMode))}:generateContent`;

    const timeout = AbortSignal.timeout(this.options.timeoutMs);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

    // The key goes in a header, never in the URL, so it cannot end up in logs or error messages.
    const body = {
      contents: [{ role: "user", parts: [{ text: textWithLyrics(request) }] }],
      generationConfig: { responseModalities: ["AUDIO", "TEXT"] },
    };

    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": this.options.apiKey },
        body: JSON.stringify(body),
        signal,
      });
    } catch {
      if (timeout.aborted) throw new ProviderError("TIMEOUT", "Lyria non ha risposto in tempo");
      if (options.signal?.aborted) throw new ProviderError("TIMEOUT", "Generazione annullata");
      throw new ProviderError("UPSTREAM", "Connessione a Lyria non riuscita");
    }

    if (response.status === 429) {
      throw new ProviderError("RATE_LIMITED", "Lyria ha risposto 429: quota superata");
    }
    if (!response.ok) {
      const detail = await errorDetail(response, this.options.apiKey);
      throw new ProviderError("UPSTREAM", `Lyria ha risposto ${response.status}${detail}`);
    }

    return parseLyriaResponse(await response.json());
  }
}

async function errorDetail(response: Response, apiKey: string): Promise<string> {
  try {
    const text = (await response.text()).split(apiKey).join("[redacted]").slice(0, 200);
    return text ? `: ${text}` : "";
  } catch {
    return "";
  }
}
