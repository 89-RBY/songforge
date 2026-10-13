import type { DurationMode } from "@/server/music/types";
import type { SongSpec } from "@/server/music/prompt";
import {
  GENRE_PROMPT,
  INSTRUMENT_PROMPT,
  SECTION_IDS,
  type GenreId,
  type InstrumentId,
  type LanguageCode,
  type LyricsMode,
  type MoodId,
  type SectionId,
  type TemplateId,
  type TimbreId,
  type VoiceId,
} from "./catalog";

// Everything the wizard collects. It lives in sessionStorage while the visitor is on the page.
export type Draft = {
  idea: string;
  templateId: TemplateId | null;
  genre: GenreId;
  subgenre: string;
  mood: MoodId;
  energy: number;
  bpm: number | null;
  voice: VoiceId;
  timbre: TimbreId | null;
  language: LanguageCode;
  instruments: InstrumentId[];
  durationMode: DurationMode;
  sections: SectionId[];
  lyricsMode: LyricsMode;
  lyrics: string;
  title: string;
  providerId: string;
  promptOverride: string | null;
};

export const DEFAULT_DRAFT: Draft = {
  idea: "",
  templateId: null,
  genre: "pop",
  subgenre: "",
  mood: "happy",
  energy: 5,
  bpm: null,
  voice: "female",
  timbre: null,
  language: "it",
  instruments: ["piano"],
  durationMode: "SONG",
  sections: [...SECTION_IDS],
  lyricsMode: "ai",
  lyrics: "",
  title: "",
  providerId: "",
  promptOverride: null,
};

// Fields that change the generated prompt. Changing one of them drops a hand-edited prompt.
export const PROMPT_KEYS = new Set<string>([
  "idea",
  "genre",
  "subgenre",
  "mood",
  "energy",
  "bpm",
  "voice",
  "timbre",
  "language",
  "instruments",
  "durationMode",
  "sections",
]);

export type ProviderOption = {
  id: string;
  label: string;
  durations: DurationMode[];
  costCents: Record<DurationMode, number>;
};

const STORAGE_KEY = "songforge.wizard.v1";

// Read with useSyncExternalStore: the server renders the default draft, the browser reads sessionStorage.
// When storage is blocked (private mode), an in-memory copy keeps the wizard working for this page visit.
const listeners = new Set<() => void>();
let memoryRaw: string | null = null;
let cachedRaw: string | null | undefined;
let cachedDraft: Draft = DEFAULT_DRAFT;

function readRaw(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) ?? memoryRaw;
  } catch {
    return memoryRaw;
  }
}

function parseDraft(raw: string | null): Draft {
  if (!raw) return DEFAULT_DRAFT;
  try {
    return { ...DEFAULT_DRAFT, ...(JSON.parse(raw) as Partial<Draft>) };
  } catch {
    return DEFAULT_DRAFT;
  }
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

// Must return the same object while nothing changed, or React re-renders forever.
export function getDraftSnapshot(): Draft {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedDraft = parseDraft(raw);
  }
  return cachedDraft;
}

export function getServerDraftSnapshot(): Draft {
  return DEFAULT_DRAFT;
}

export function subscribeDraft(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function writeDraft(draft: Draft): void {
  const raw = JSON.stringify(draft);
  memoryRaw = raw;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // Storage is blocked: the in-memory copy above is used instead.
  }
  notify();
}

export function clearDraft(): void {
  memoryRaw = null;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to remove if storage is unavailable.
  }
  notify();
}

export function isInstrumental(draft: Pick<Draft, "voice">): boolean {
  return draft.voice === "instrumental";
}

export function toSongSpec(draft: Draft): SongSpec {
  return {
    idea: draft.idea.trim() || undefined,
    genre: GENRE_PROMPT[draft.genre],
    subgenre: draft.subgenre.trim() || undefined,
    mood: draft.mood,
    energy: draft.energy,
    bpm: draft.bpm ?? undefined,
    vocal: draft.voice,
    vocalTimbre: draft.timbre ?? undefined,
    language: draft.language,
    instruments: draft.instruments.map((id) => INSTRUMENT_PROMPT[id]),
    structure: draft.durationMode === "SONG" ? SECTION_IDS.filter((id) => draft.sections.includes(id)) : undefined,
    durationMode: draft.durationMode,
  };
}
