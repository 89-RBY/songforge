import { describe, expect, it } from "vitest";
import { encodeWav, MockProvider, renderChord } from "@/server/music/providers/mock";
import { ProviderError } from "@/server/music/types";

describe("encodeWav", () => {
  it("writes a valid 16-bit mono PCM WAV header", () => {
    const samples = new Int16Array([0, 1000, -1000, 0]);
    const wav = encodeWav(samples, 22050);
    const view = new DataView(wav.buffer);
    const text = (offset: number, length: number) => String.fromCharCode(...wav.slice(offset, offset + length));

    expect(text(0, 4)).toBe("RIFF");
    expect(text(8, 4)).toBe("WAVE");
    expect(text(12, 4)).toBe("fmt ");
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(22050);
    expect(view.getUint16(34, true)).toBe(16);
    expect(text(36, 4)).toBe("data");
    expect(view.getUint32(40, true)).toBe(samples.length * 2);
    expect(wav.byteLength).toBe(44 + samples.length * 2);
  });
});

describe("renderChord", () => {
  it("produces the requested length, fades in from silence and stays in range", () => {
    const samples = renderChord(1, 22050);
    expect(samples.length).toBe(22050);
    expect(Math.abs(samples[0])).toBeLessThan(50);
    const peak = samples.reduce((max, s) => Math.max(max, Math.abs(s)), 0);
    expect(peak).toBeGreaterThan(1000);
    expect(peak).toBeLessThanOrEqual(32767);
  });
});

describe("MockProvider", () => {
  it("returns a WAV file of 5 seconds for a clip and 8 seconds for a song", async () => {
    const provider = new MockProvider(0);
    const clip = await provider.generate({ prompt: "p", instrumental: true, durationMode: "CLIP" });
    const song = await provider.generate({ prompt: "p", instrumental: true, durationMode: "SONG" });
    expect(clip.mimeType).toBe("audio/wav");
    expect(clip.durationSeconds).toBe(5);
    expect(song.durationSeconds).toBe(8);
    expect(song.data.byteLength).toBe(44 + 8 * 22050 * 2);
  });

  it("returns placeholder lyria only when the song is not instrumental", async () => {
    const provider = new MockProvider(0);
    const withVocals = await provider.generate({ prompt: "p", instrumental: false, durationMode: "CLIP" });
    const instrumental = await provider.generate({ prompt: "p", instrumental: true, durationMode: "CLIP" });
    expect(withVocals.lyrics).toContain("Testo di prova");
    expect(instrumental.lyrics).toBeUndefined();
  });

  it("costs nothing", () => {
    expect(new MockProvider(0).estimateCostCents("CLIP")).toBe(0);
  });

  it("stops during the simulated delay when the caller aborts", async () => {
    const provider = new MockProvider(60_000);
    const controller = new AbortController();
    const pending = provider.generate(
      { prompt: "p", instrumental: true, durationMode: "CLIP" },
      { signal: controller.signal },
    );
    controller.abort();
    await expect(pending).rejects.toBeInstanceOf(ProviderError);
  });
});
