import { ProviderError, type DurationMode, type GeneratedAudio, type MusicProvider, type MusicRequest } from "../types";

const SAMPLE_RATE = 22050;
// Development only: short clips so the full flow can be tested quickly.
const MOCK_SECONDS: Record<DurationMode, number> = { CLIP: 5, SONG: 8 };

export type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>;

export const defaultSleep: Sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new ProviderError("TIMEOUT", "Generazione annullata"));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new ProviderError("TIMEOUT", "Generazione annullata"));
      },
      { once: true },
    );
  });

// Renders a soft three-note chord with fades, as 16-bit mono PCM.
export function renderChord(seconds: number, sampleRate = SAMPLE_RATE): Int16Array {
  const frequencies = [220, 277.18, 329.63];
  const total = Math.floor(seconds * sampleRate);
  const fade = Math.floor(0.2 * sampleRate);
  const samples = new Int16Array(total);
  for (let i = 0; i < total; i++) {
    let value = 0;
    for (const f of frequencies) value += Math.sin((2 * Math.PI * f * i) / sampleRate);
    const envelope = Math.min(1, i / fade, (total - i) / fade);
    samples[i] = Math.round((value / frequencies.length) * envelope * 0.6 * 32767);
  }
  return samples;
}

export function encodeWav(samples: Int16Array, sampleRate = SAMPLE_RATE): Uint8Array {
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, dataSize, true);
  new Int16Array(buffer, 44).set(samples);
  return new Uint8Array(buffer);
}

export class MockProvider implements MusicProvider {
  readonly id = "mock";
  readonly label = "Prova (audio di esempio)";
  readonly capabilities = { durations: ["CLIP", "SONG"] as const, imageInput: false };

  constructor(
    private readonly delayMs: number,
    private readonly sleep: Sleep = defaultSleep,
  ) {}

  estimateCostCents(): number {
    return 0;
  }

  async generate(request: MusicRequest, options: { signal?: AbortSignal } = {}): Promise<GeneratedAudio> {
    await this.sleep(this.delayMs, options.signal);
    const seconds = MOCK_SECONDS[request.durationMode];
    return {
      data: encodeWav(renderChord(seconds)),
      mimeType: "audio/wav",
      durationSeconds: seconds,
      lyrics: request.instrumental ? undefined : "[Mock]\nTesto di prova, non generato dall'AI",
    };
  }
}
