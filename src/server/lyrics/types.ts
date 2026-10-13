export type LyricsRequest = {
  idea?: string;
  genre: string;
  mood: string;
  voice: string;
  language: string;
  sections: string[];
};

export type LyricsErrorCode = "UPSTREAM" | "EMPTY";

export class LyricsError extends Error {
  readonly code: LyricsErrorCode;

  constructor(code: LyricsErrorCode, message: string) {
    super(message);
    this.name = "LyricsError";
    this.code = code;
  }
}

export interface LyricsProvider {
  readonly id: string;
  generate(request: LyricsRequest): Promise<string>;
}
