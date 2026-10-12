import { describe, expect, it } from "vitest";
import { LyriaProvider, parseLyriaResponse } from "@/server/music/providers/lyria";
import { ProviderError } from "@/server/music/types";

const KEY = "test-key-123";
const BASE = "https://generativelanguage.googleapis.com";
const audioBytes = Buffer.from("ID3-fake-mp3-bytes");

const okPayload = {
  candidates: [
    {
      content: {
        parts: [
          { text: "[Verse]\nprima strofa" },
          { inlineData: { mimeType: "audio/mpeg", data: audioBytes.toString("base64") } },
        ],
      },
    },
  ],
};

function providerWith(fetchImpl: typeof fetch, timeoutMs = 60_000) {
  return new LyriaProvider({
    apiKey: KEY,
    baseUrl: BASE,
    songModel: "lyria-3.5",
    clipModel: "lyria-3-clip-preview",
    timeoutMs,
    fetchImpl,
  });
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function expectError(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ProviderError);
  expect((error as ProviderError).code).toBe(code);
  return error as ProviderError;
}

describe("LyriaProvider", () => {
  it("returns the decoded audio and the lyrics, using the song model for SONG", async () => {
    let captured: { url: string; init: RequestInit } | undefined;
    const provider = providerWith(async (url, init) => {
      captured = { url: String(url), init: init! };
      return json(okPayload);
    });

    const result = await provider.generate({ prompt: "rock malinconico", instrumental: false, durationMode: "SONG" });

    expect(Buffer.from(result.data).equals(audioBytes)).toBe(true);
    expect(result.mimeType).toBe("audio/mpeg");
    expect(result.lyrics).toBe("[Verse]\nprima strofa");
    expect(captured!.url).toBe(`${BASE}/v1beta/models/lyria-3.5:generateContent`);
  });

  it("uses the clip model for CLIP and sends the prompt and the requested modalities", async () => {
    let body: { contents: { parts: { text: string }[] }[]; generationConfig: { responseModalities: string[] } } | undefined;
    const provider = providerWith(async (_url, init) => {
      body = JSON.parse(String(init!.body));
      return json(okPayload);
    });

    await provider.generate({ prompt: "clip di prova", instrumental: true, durationMode: "CLIP" });

    expect(body!.contents[0].parts[0].text).toBe("clip di prova");
    expect(body!.generationConfig.responseModalities).toEqual(["AUDIO", "TEXT"]);
  });

  it("sends the key in a header and never in the URL", async () => {
    let captured: { url: string; init: RequestInit } | undefined;
    const provider = providerWith(async (url, init) => {
      captured = { url: String(url), init: init! };
      return json(okPayload);
    });

    await provider.generate({ prompt: "p", instrumental: false, durationMode: "SONG" });

    expect(captured!.url).not.toContain(KEY);
    expect((captured!.init.headers as Record<string, string>)["x-goog-api-key"]).toBe(KEY);
  });

  it("maps HTTP 429 to a retryable RATE_LIMITED error", async () => {
    const provider = providerWith(async () => json({ error: "quota" }, 429));
    const error = await expectError(provider.generate({ prompt: "p", instrumental: false, durationMode: "SONG" }), "RATE_LIMITED");
    expect(error.retryable).toBe(true);
  });

  it("redacts the key if the upstream error echoes it back", async () => {
    const provider = providerWith(async () => new Response(`bad key ${KEY}`, { status: 403 }));
    const error = await expectError(provider.generate({ prompt: "p", instrumental: false, durationMode: "SONG" }), "UPSTREAM");
    expect(error.message).not.toContain(KEY);
    expect(error.message).toContain("[redacted]");
  });

  it("treats a network failure as a retryable UPSTREAM error", async () => {
    const provider = providerWith(async () => {
      throw new TypeError("fetch failed");
    });
    const error = await expectError(provider.generate({ prompt: "p", instrumental: false, durationMode: "SONG" }), "UPSTREAM");
    expect(error.retryable).toBe(true);
  });

  it("reports TIMEOUT when the model does not answer in time", async () => {
    const provider = providerWith(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init!.signal!.addEventListener("abort", () => reject(new Error("aborted")));
        }),
      20,
    );
    await expectError(provider.generate({ prompt: "p", instrumental: false, durationMode: "SONG" }), "TIMEOUT");
  });

  it("estimates the price per mode: 8 cents for a song, 4 for a clip", () => {
    const provider = providerWith(async () => json(okPayload));
    expect(provider.estimateCostCents("SONG")).toBe(8);
    expect(provider.estimateCostCents("CLIP")).toBe(4);
  });
});

describe("parseLyriaResponse", () => {
  it("treats a promptFeedback.blockReason as BLOCKED and not retryable", () => {
    try {
      parseLyriaResponse({ promptFeedback: { blockReason: "PROHIBITED_CONTENT" } });
      throw new Error("expected a throw");
    } catch (error) {
      expect((error as ProviderError).code).toBe("BLOCKED");
      expect((error as ProviderError).retryable).toBe(false);
    }
  });

  it("treats a PROHIBITED_CONTENT finish reason as BLOCKED even with HTTP 200", () => {
    expect(() =>
      parseLyriaResponse({ candidates: [{ finishReason: "PROHIBITED_CONTENT", content: { parts: [] } }] }),
    ).toThrow(ProviderError);
  });

  it("reports INVALID_RESPONSE when no audio part is present", () => {
    try {
      parseLyriaResponse({ candidates: [{ content: { parts: [{ text: "solo testo" }] } }] });
      throw new Error("expected a throw");
    } catch (error) {
      expect((error as ProviderError).code).toBe("INVALID_RESPONSE");
    }
  });

  it("returns no lyrics when the response has only audio", () => {
    const result = parseLyriaResponse({
      candidates: [{ content: { parts: [{ inlineData: { mimeType: "audio/mpeg", data: "AAAA" } }] } }],
    });
    expect(result.lyrics).toBeUndefined();
  });
});
