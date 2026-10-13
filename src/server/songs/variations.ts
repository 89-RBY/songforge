export const VARIATIONS = ["more_energy", "other_voice", "new_lyrics"] as const;
export type Variation = (typeof VARIATIONS)[number];

const DIRECTIVE: Record<Variation, string> = {
  more_energy: "Variation: make it noticeably more energetic and punchy than the previous version, keeping the same genre and mood.",
  other_voice: "Variation: use a different lead singer, with another voice type and timbre than the previous version.",
  new_lyrics: "Variation: keep the same style, but write completely new lyrics.",
};

// Keeps the prompt within the input limit, then adds one directive for the chosen variation.
// "New lyrics" drops the old lyrics, so the model writes new ones.
export function applyVariation({
  prompt,
  lyrics,
  variation,
}: {
  prompt: string;
  lyrics: string | null;
  variation: Variation;
}): { prompt: string; lyrics: string | null } {
  const base = prompt.slice(0, 1800).trimEnd();
  return {
    prompt: `${base}\n${DIRECTIVE[variation]}`,
    lyrics: variation === "new_lyrics" ? null : lyrics,
  };
}
