// First layer of moderation: a deterministic check on the prompt text.
// A classifier can be added later as a second layer; this one is the minimum that is always on.

export type ModerationResult = { allowed: true } | { allowed: false; reason: "ARTIST_IMITATION" };

// Starter list of real artists. Requests that name them are refused: they could be asking for
// a specific person's voice or style. Single words that are also common Italian words
// (e.g. "Mina", "Madonna") are left out to avoid blocking ordinary requests; full names are used instead.
const ARTIST_NAMES = [
  "Michael Jackson",
  "Taylor Swift",
  "Ed Sheeran",
  "Bob Dylan",
  "Freddie Mercury",
  "Elvis Presley",
  "Dua Lipa",
  "Kendrick Lamar",
  "Bad Bunny",
  "Laura Pausini",
  "Eros Ramazzotti",
  "Lucio Dalla",
  "Vasco Rossi",
  "Eminem",
  "Ligabue",
  "Beyonce",
];

// Lowercase, no accents, single spaces: so "Beyoncé" and "beyonce" match the same entry.
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Word boundaries on both sides, so "determina" does not match a name that is part of a longer word.
const PATTERNS = ARTIST_NAMES.map(
  (name) => new RegExp(`(^|[^a-z])${escapeRegExp(normalizeForMatch(name))}([^a-z]|$)`),
);

export function checkPrompt(text: string): ModerationResult {
  const normalized = normalizeForMatch(text);
  const named = PATTERNS.some((pattern) => pattern.test(normalized));
  return named ? { allowed: false, reason: "ARTIST_IMITATION" } : { allowed: true };
}
