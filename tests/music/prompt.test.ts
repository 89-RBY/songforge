import { describe, expect, it } from "vitest";
import { buildLyriaPrompt, type SongSpec } from "@/server/music/prompt";

const base: SongSpec = {
  genre: "pop",
  mood: "felice",
  energy: 7,
  vocal: "female",
  instruments: ["piano", "sintetizzatore"],
  durationMode: "SONG",
};

describe("buildLyriaPrompt", () => {
  it("asks for a complete song with its sections when the mode is SONG", () => {
    const prompt = buildLyriaPrompt(base);
    expect(prompt).toContain("complete song of about two minutes");
    expect(prompt).toContain("bridge");
  });

  it("asks for a 30-second clip when the mode is CLIP", () => {
    expect(buildLyriaPrompt({ ...base, durationMode: "CLIP" })).toContain("30-second music clip");
  });

  it("describes the genre with its subgenre and the energy level", () => {
    const prompt = buildLyriaPrompt({ ...base, genre: "rock", subgenre: "alternativo", energy: 9 });
    expect(prompt).toContain("Genre: rock, alternativo.");
    expect(prompt).toContain("explosive (9/10)");
  });

  it("writes the vocal style and timbre, and maps the language code to a name", () => {
    const prompt = buildLyriaPrompt({ ...base, vocal: "duet", vocalTimbre: "calda", language: "it" });
    expect(prompt).toContain("a male and a female duet, calda timbre");
    expect(prompt).toContain("Lyrics language: Italian.");
  });

  it("defaults the lyrics language to English", () => {
    expect(buildLyriaPrompt(base)).toContain("Lyrics language: English.");
  });

  it("asks for instrumental music without a vocal line when vocal is instrumental", () => {
    const prompt = buildLyriaPrompt({ ...base, vocal: "instrumental" });
    expect(prompt).toContain("Instrumental only, no vocals.");
    expect(prompt).not.toContain("Vocals:");
  });

  it("adds the tempo only when a BPM is set", () => {
    expect(buildLyriaPrompt(base)).not.toContain("BPM");
    expect(buildLyriaPrompt({ ...base, bpm: 120 })).toContain("Tempo: around 120 BPM.");
  });

  it("rejects energy outside 1 to 10", () => {
    expect(() => buildLyriaPrompt({ ...base, energy: 0 })).toThrow(RangeError);
    expect(() => buildLyriaPrompt({ ...base, energy: 11 })).toThrow(RangeError);
    expect(() => buildLyriaPrompt({ ...base, energy: 5.5 })).toThrow(RangeError);
  });

  it("rejects a BPM outside 60 to 200", () => {
    expect(() => buildLyriaPrompt({ ...base, bpm: 59 })).toThrow(RangeError);
    expect(() => buildLyriaPrompt({ ...base, bpm: 201 })).toThrow(RangeError);
  });

  it("limits the theme to 500 characters and collapses whitespace", () => {
    const prompt = buildLyriaPrompt({ ...base, idea: `  ${"a   ".repeat(400)}  ` });
    const theme = prompt.split("\n").find((line) => line.startsWith("Theme: "));
    expect(theme).toBeDefined();
    expect(theme!.length).toBeLessThanOrEqual("Theme: ".length + 500);
    expect(theme).not.toContain("   ");
  });
});
