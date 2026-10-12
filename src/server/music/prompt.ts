import type { DurationMode } from "./types";

export type VocalStyle = "male" | "female" | "duet" | "choir" | "instrumental";

export type SongSpec = {
  idea?: string;
  genre: string;
  subgenre?: string;
  mood: string;
  energy: number; // 1 (calm) to 10 (explosive)
  bpm?: number; // 60 to 200
  vocal: VocalStyle;
  vocalTimbre?: string;
  language?: string;
  instruments: string[];
  durationMode: DurationMode;
};

const LANGUAGE_NAMES: Record<string, string> = {
  it: "Italian",
  en: "English",
  ro: "Romanian",
  es: "Spanish",
  fr: "French",
  de: "German",
};

const VOCAL_TEXT: Record<VocalStyle, string> = {
  male: "a male lead vocal",
  female: "a female lead vocal",
  duet: "a male and a female duet",
  choir: "a choir",
  instrumental: "no vocals",
};

function clean(value: string, maxLength: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function energyLabel(energy: number): string {
  if (energy <= 3) return "calm and relaxed";
  if (energy <= 6) return "medium energy";
  if (energy <= 8) return "energetic";
  return "explosive";
}

// Turns the wizard choices into the text sent to the model. Pure function: it is what the tests cover.
export function buildLyriaPrompt(spec: SongSpec): string {
  if (!Number.isInteger(spec.energy) || spec.energy < 1 || spec.energy > 10) {
    throw new RangeError("energy deve essere un intero tra 1 e 10");
  }
  if (spec.bpm !== undefined && (!Number.isInteger(spec.bpm) || spec.bpm < 60 || spec.bpm > 200)) {
    throw new RangeError("bpm deve essere un intero tra 60 e 200");
  }

  const genre = clean(spec.subgenre ? `${spec.genre}, ${spec.subgenre}` : spec.genre, 80);
  const lines: string[] = [];

  lines.push(
    spec.durationMode === "CLIP"
      ? "Create an original 30-second music clip."
      : "Create an original complete song of about two minutes, with intro, verse, chorus, bridge and outro.",
  );
  lines.push(`Genre: ${genre}.`);
  lines.push(`Mood: ${clean(spec.mood, 60)}. Energy: ${energyLabel(spec.energy)} (${spec.energy}/10).`);
  if (spec.bpm) lines.push(`Tempo: around ${spec.bpm} BPM.`);

  if (spec.vocal === "instrumental") {
    lines.push("Instrumental only, no vocals.");
  } else {
    const timbre = spec.vocalTimbre ? `, ${clean(spec.vocalTimbre, 40)} timbre` : "";
    const language = spec.language ? LANGUAGE_NAMES[spec.language] ?? spec.language : "English";
    lines.push(`Vocals: ${VOCAL_TEXT[spec.vocal]}${timbre}. Lyrics language: ${language}.`);
  }

  if (spec.instruments.length > 0) {
    lines.push(`Main instruments: ${spec.instruments.map((i) => clean(i, 40)).join(", ")}.`);
  }
  if (spec.idea) lines.push(`Theme: ${clean(spec.idea, 500)}`);

  return lines.join("\n");
}
