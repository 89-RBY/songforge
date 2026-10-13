import { LANGUAGE_NAMES } from "@/server/music/prompt";
import type { LyricsRequest } from "./types";

export const LYRICS_SYSTEM_PROMPT = [
  "You write original song lyrics.",
  "Reply with the lyrics only: no title, no commentary, no markdown.",
  "Mark sections with square brackets such as [Verse 1], [Chorus], [Bridge], [Outro].",
  "Write in the requested language.",
  "Never imitate a real artist and never reproduce existing copyrighted lyrics.",
].join(" ");

export function buildLyricsUserMessage(request: LyricsRequest): string {
  const language = LANGUAGE_NAMES[request.language] ?? request.language;
  return [
    `Language: ${language}`,
    `Genre: ${request.genre}`,
    `Mood: ${request.mood}`,
    `Voice: ${request.voice}`,
    `Sections, in order: ${request.sections.join(", ")}`,
    `Theme: ${request.idea?.trim() || "free choice, make it original"}`,
  ].join("\n");
}
