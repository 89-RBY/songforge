import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { ClaudeLyricsProvider } from "@/server/lyrics/claude";
import { createLyricsProvider } from "@/server/lyrics";
import { buildLyricsUserMessage, LYRICS_SYSTEM_PROMPT } from "@/server/lyrics/prompt";
import { MockLyricsProvider } from "@/server/lyrics/mock";
import { LyricsError, type LyricsRequest } from "@/server/lyrics/types";

const request: LyricsRequest = {
  idea: "il compleanno di mia madre",
  genre: "pop",
  mood: "happy",
  voice: "female",
  language: "it",
  sections: ["verse", "chorus"],
};

type FakeCall = Record<string, unknown>;

function fakeClient(respond: () => unknown) {
  const calls: FakeCall[] = [];
  const client = {
    messages: {
      create: async (params: FakeCall) => {
        calls.push(params);
        return respond();
      },
    },
  };
  return { client: client as unknown as Pick<Anthropic, "messages">, calls };
}

describe("lyrics prompt", () => {
  it("names the language and the theme, and falls back when there is no theme", () => {
    const message = buildLyricsUserMessage(request);
    expect(message).toContain("Language: Italian");
    expect(message).toContain("Theme: il compleanno di mia madre");
    expect(buildLyricsUserMessage({ ...request, idea: undefined })).toContain("Theme: free choice");
  });

  it("forbids copying artists and copyrighted lyrics in the system prompt", () => {
    expect(LYRICS_SYSTEM_PROMPT).toContain("Never imitate a real artist");
  });
});

describe("ClaudeLyricsProvider", () => {
  it("sends the request with the configured model and a bounded output size", async () => {
    const { client, calls } = fakeClient(() => ({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "[Verse]\nprima strofa" }],
    }));
    const provider = new ClaudeLyricsProvider({ apiKey: "test", model: "claude-opus-5-5", client });

    const lyrics = await provider.generate(request);

    expect(lyrics).toBe("[Verse]\nprima strofa");
    expect(calls[0].model).toBe("claude-opus-5-5");
    expect(calls[0].max_tokens).toBe(2000);
    expect(calls[0].system).toBe(LYRICS_SYSTEM_PROMPT);
  });

  it("joins only the text blocks of the reply", async () => {
    const { client } = fakeClient(() => ({
      stop_reason: "end_turn",
      content: [
        { type: "text", text: "[Verse]" },
        { type: "thinking", thinking: "..." },
        { type: "text", text: "ciao" },
      ],
    }));
    const provider = new ClaudeLyricsProvider({ apiKey: "test", model: "m", client });
    expect(await provider.generate(request)).toBe("[Verse]\nciao");
  });

  it("reports an empty reply as EMPTY", async () => {
    const { client } = fakeClient(() => ({ stop_reason: "end_turn", content: [] }));
    const provider = new ClaudeLyricsProvider({ apiKey: "test", model: "m", client });
    await expect(provider.generate(request)).rejects.toMatchObject({ code: "EMPTY" });
  });

  it("reports a refusal as UPSTREAM", async () => {
    const { client } = fakeClient(() => ({ stop_reason: "refusal", content: [] }));
    const provider = new ClaudeLyricsProvider({ apiKey: "test", model: "m", client });
    await expect(provider.generate(request)).rejects.toBeInstanceOf(LyricsError);
  });

  it("reports a failed call as UPSTREAM", async () => {
    const provider = new ClaudeLyricsProvider({
      apiKey: "test",
      model: "m",
      client: {
        messages: {
          create: async () => {
            throw new Error("rete");
          },
        },
      } as unknown as Pick<Anthropic, "messages">,
    });
    await expect(provider.generate(request)).rejects.toMatchObject({ code: "UPSTREAM" });
  });
});

describe("MockLyricsProvider", () => {
  it("returns one tagged section per requested section", async () => {
    const lyrics = await new MockLyricsProvider().generate(request);
    expect(lyrics).toContain("[Verse]");
    expect(lyrics).toContain("[Chorus]");
    expect(lyrics).toContain("il compleanno di mia madre");
  });
});

describe("createLyricsProvider", () => {
  const base = { ANTHROPIC_API_KEY: undefined, LYRICS_MODEL: "claude-opus-5-5", MOCK_PROVIDER: false };

  it("uses Claude when a key is configured", () => {
    expect(createLyricsProvider({ ...base, ANTHROPIC_API_KEY: "k" })?.id).toBe("claude");
  });

  it("uses the mock when only the mock provider is enabled", () => {
    expect(createLyricsProvider({ ...base, MOCK_PROVIDER: true })?.id).toBe("mock");
  });

  it("returns nothing when no lyrics service is configured", () => {
    expect(createLyricsProvider(base)).toBeNull();
  });
});
