import { describe, expect, it } from "vitest";
import { textWithLyrics } from "@/server/music/providers/lyria";

const base = { prompt: "Create an original song.", instrumental: false, durationMode: "SONG" as const };

describe("textWithLyrics", () => {
  it("keeps the prompt unchanged when there are no lyrics", () => {
    expect(textWithLyrics(base)).toBe("Create an original song.");
  });

  it("appends the lyrics after the prompt, with their section labels", () => {
    const text = textWithLyrics({ ...base, lyrics: "[Verse]\nprima strofa" });
    expect(text.startsWith("Create an original song.")).toBe(true);
    expect(text).toContain("Use these lyrics");
    expect(text.endsWith("[Verse]\nprima strofa")).toBe(true);
  });
});
