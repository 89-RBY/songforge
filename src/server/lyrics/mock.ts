import type { LyricsProvider, LyricsRequest } from "./types";

// Development only: placeholder lyrics with the same section structure, no external call.
export class MockLyricsProvider implements LyricsProvider {
  readonly id = "mock";

  async generate(request: LyricsRequest): Promise<string> {
    const theme = request.idea?.trim() || "musica";
    const sections = request.sections.length > 0 ? request.sections : ["verse", "chorus"];
    return sections
      .map((section) => `[${section.charAt(0).toUpperCase()}${section.slice(1)}]\n(testo di prova: ${theme})`)
      .join("\n\n");
  }
}
