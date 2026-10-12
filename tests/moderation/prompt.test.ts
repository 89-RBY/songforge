import { describe, expect, it } from "vitest";
import { checkPrompt } from "@/server/moderation/prompt";

describe("checkPrompt", () => {
  it.each([
    "una canzone nello stile di Ligabue",
    "voce come Beyoncé nel ritornello",
    "TAYLOR    SWIFT style pop song",
    "like Michael Jackson but faster",
  ])("refuses requests that name a real artist: %s", (text) => {
    expect(checkPrompt(text)).toEqual({ allowed: false, reason: "ARTIST_IMITATION" });
  });

  it.each([
    "una canzone che determina il futuro",
    "una canzone sulla madonna del mare",
    "rock energico con chitarre distorte per la festa di mamma",
  ])("allows ordinary requests: %s", (text) => {
    expect(checkPrompt(text)).toEqual({ allowed: true });
  });
});
