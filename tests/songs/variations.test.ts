import { describe, expect, it } from "vitest";
import { applyVariation } from "@/server/songs/variations";

describe("applyVariation", () => {
  it("adds one directive and keeps the lyrics for energy and voice changes", () => {
    const result = applyVariation({ prompt: "rock energico", lyrics: "[Verse]\nciao", variation: "more_energy" });
    expect(result.prompt).toContain("more energetic");
    expect(result.lyrics).toBe("[Verse]\nciao");
  });

  it("drops the lyrics when new lyrics are requested", () => {
    expect(applyVariation({ prompt: "pop", lyrics: "testo", variation: "new_lyrics" }).lyrics).toBeNull();
  });

  it("keeps the base prompt within the input limit", () => {
    const long = "a".repeat(2000);
    const result = applyVariation({ prompt: long, lyrics: null, variation: "other_voice" });
    expect(result.prompt.startsWith("a".repeat(1800))).toBe(true);
    expect(result.prompt).toContain("different lead singer");
  });
});
