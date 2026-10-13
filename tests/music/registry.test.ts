import { describe, expect, it } from "vitest";
import { createProviders, findProvider } from "@/server/music/registry";

const base = {
  MOCK_PROVIDER: false,
  MOCK_DELAY_MS: 0, MOCK_COST_CENTS: 0,
  GEMINI_API_KEY: undefined,
  GEMINI_BASE_URL: "https://generativelanguage.googleapis.com",
  LYRIA_SONG_MODEL: "lyria-3.5",
  LYRIA_CLIP_MODEL: "lyria-3-clip-preview",
  LYRIA_TIMEOUT_MS: 600000,
};

describe("createProviders", () => {
  it("lists only the mock when only MOCK_PROVIDER is set", () => {
    expect(createProviders({ ...base, MOCK_PROVIDER: true }).map((p) => p.id)).toEqual(["mock"]);
  });

  it("lists only Lyria when only a Gemini key is set", () => {
    expect(createProviders({ ...base, GEMINI_API_KEY: "k" }).map((p) => p.id)).toEqual(["lyria"]);
  });

  it("lists both when both are configured", () => {
    expect(createProviders({ ...base, MOCK_PROVIDER: true, GEMINI_API_KEY: "k" }).map((p) => p.id)).toEqual([
      "mock",
      "lyria",
    ]);
  });

  it("returns nothing when no provider is configured", () => {
    expect(createProviders(base)).toEqual([]);
  });
});

describe("findProvider", () => {
  it("finds a provider by id and returns undefined for an unknown one", () => {
    const providers = createProviders({ ...base, MOCK_PROVIDER: true });
    expect(findProvider(providers, "mock")?.id).toBe("mock");
    expect(findProvider(providers, "suno")).toBeUndefined();
  });
});
