// Ids used by the wizard. Labels live in the dictionaries; the English names here are what the model reads.
export const GENRE_IDS = ["pop", "rock", "hiphop", "electronic", "reggaeton", "lofi", "folk", "jazz", "classical", "trap"] as const;
export type GenreId = (typeof GENRE_IDS)[number];

export const GENRE_PROMPT: Record<GenreId, string> = {
  pop: "pop",
  rock: "rock",
  hiphop: "hip hop",
  electronic: "electronic",
  reggaeton: "reggaeton",
  lofi: "lo-fi",
  folk: "folk",
  jazz: "jazz",
  classical: "classical",
  trap: "trap",
};

export const GENRE_ICONS: Record<GenreId, string> = {
  pop: "🎤",
  rock: "🎸",
  hiphop: "🎧",
  electronic: "🎛️",
  reggaeton: "🔥",
  lofi: "☕",
  folk: "🪕",
  jazz: "🎷",
  classical: "🎻",
  trap: "🎹",
};

export const MOOD_IDS = ["happy", "melancholic", "epic", "romantic", "relaxed", "aggressive"] as const;
export type MoodId = (typeof MOOD_IDS)[number];

// Hue used for the cover gradient and the colour swatch of each mood.
export const MOOD_HUE: Record<MoodId, number> = {
  happy: 42,
  melancholic: 215,
  epic: 275,
  romantic: 335,
  relaxed: 165,
  aggressive: 4,
};

export const VOICE_IDS = ["male", "female", "duet", "choir", "instrumental"] as const;
export type VoiceId = (typeof VOICE_IDS)[number];

export const TIMBRE_IDS = ["warm", "raspy", "ethereal", "bright", "deep"] as const;
export type TimbreId = (typeof TIMBRE_IDS)[number];

export const INSTRUMENT_IDS = ["guitar", "piano", "synth", "strings", "drums", "bass", "brass", "saxophone"] as const;
export type InstrumentId = (typeof INSTRUMENT_IDS)[number];

export const INSTRUMENT_PROMPT: Record<InstrumentId, string> = {
  guitar: "guitar",
  piano: "piano",
  synth: "synthesizer",
  strings: "strings",
  drums: "drums",
  bass: "bass",
  brass: "brass",
  saxophone: "saxophone",
};

export const SECTION_IDS = ["intro", "verse", "chorus", "bridge", "outro"] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export const TEMPLATE_IDS = ["birthday", "wedding", "jingle", "video", "love"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export const LANGUAGES = [
  { code: "it", name: "Italiano" },
  { code: "en", name: "English" },
  { code: "ro", name: "Română" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
] as const;
export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export const STEP_IDS = [
  "idea",
  "genre",
  "mood",
  "energy",
  "tempo",
  "voice",
  "language",
  "instruments",
  "structure",
  "lyrics",
  "summary",
] as const;
export type StepId = (typeof STEP_IDS)[number];

export const LYRICS_MODES = ["ai", "own", "editable"] as const;
export type LyricsMode = (typeof LYRICS_MODES)[number];
