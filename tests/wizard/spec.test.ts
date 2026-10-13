import { describe, expect, it } from "vitest";
import { DEFAULT_DRAFT, toSongSpec, type Draft } from "@/features/wizard/draft";
import { buildLyriaPrompt } from "@/server/music/prompt";

const draft = (patch: Partial<Draft>): Draft => ({ ...DEFAULT_DRAFT, ...patch });

describe("wizard choices to song spec", () => {
  it("writes the model names of genre and instruments, not the UI ids", () => {
    const spec = toSongSpec(draft({ genre: "hiphop", instruments: ["synth", "drums"] }));
    expect(spec.genre).toBe("hip hop");
    expect(spec.instruments).toEqual(["synthesizer", "drums"]);
  });

  it("keeps the sections in song order, whatever order they were selected in", () => {
    const spec = toSongSpec(draft({ durationMode: "SONG", sections: ["outro", "intro", "chorus"] }));
    expect(spec.structure).toEqual(["intro", "chorus", "outro"]);
  });

  it("has no structure for a short clip", () => {
    expect(toSongSpec(draft({ durationMode: "CLIP" })).structure).toBeUndefined();
  });

  it("reads an empty BPM as automatic tempo", () => {
    expect(toSongSpec(draft({ bpm: null })).bpm).toBeUndefined();
  });

  it("produces a prompt that describes the chosen structure", () => {
    const prompt = buildLyriaPrompt(toSongSpec(draft({ sections: ["verse", "chorus", "outro"] })));
    expect(prompt).toContain("Structure: verse, chorus, outro.");
  });

  it("describes the default draft as a full song with the default structure", () => {
    const prompt = buildLyriaPrompt(toSongSpec(DEFAULT_DRAFT));
    expect(prompt).toContain("Structure: intro, verse, chorus, bridge, outro.");
    expect(prompt).toContain("Vocals: a female lead vocal. Lyrics language: Italian.");
  });
});
