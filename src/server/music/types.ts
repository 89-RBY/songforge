export type DurationMode = "CLIP" | "SONG";

export type MusicRequest = {
  prompt: string;
  lyrics?: string;
  instrumental: boolean;
  durationMode: DurationMode;
};

export type GeneratedAudio = {
  data: Uint8Array;
  mimeType: string;
  durationSeconds?: number;
  lyrics?: string;
};

export type ProviderErrorCode = "BLOCKED" | "RATE_LIMITED" | "TIMEOUT" | "UPSTREAM" | "INVALID_RESPONSE";

// Retryable errors are transient; BLOCKED is final: the same prompt will be blocked again.
export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly retryable: boolean;

  constructor(code: ProviderErrorCode, message: string) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.retryable = code === "RATE_LIMITED" || code === "TIMEOUT" || code === "UPSTREAM";
  }
}

export interface MusicProvider {
  readonly id: string;
  readonly label: string;
  readonly capabilities: {
    readonly durations: readonly DurationMode[];
    readonly imageInput: boolean;
  };
  estimateCostCents(durationMode: DurationMode): number;
  generate(request: MusicRequest, options?: { signal?: AbortSignal }): Promise<GeneratedAudio>;
}
