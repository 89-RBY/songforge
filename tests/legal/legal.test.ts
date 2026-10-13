import { describe, expect, it } from "vitest";
import { LEGAL, legalFor } from "@/content/legal";
import { LOCALES } from "@/i18n/routing";

describe("legal drafts", () => {
  it("has the same sections in Italian and English, so neither version is missing a clause", () => {
    for (const kind of ["terms", "privacy"] as const) {
      const italian = LEGAL.it[kind].sections.map((section) => section.heading.replace(/^\d+\.\s*/, ""));
      const english = LEGAL.en[kind].sections.map((section) => section.heading.replace(/^\d+\.\s*/, ""));
      expect(english).toHaveLength(italian.length);
      expect(LEGAL.en[kind].sections.map((section) => section.heading.split(".")[0])).toEqual(
        LEGAL.it[kind].sections.map((section) => section.heading.split(".")[0]),
      );
    }
  });

  it("has no empty sections", () => {
    for (const language of ["it", "en"] as const) {
      for (const kind of ["terms", "privacy"] as const) {
        for (const section of LEGAL[language][kind].sections) {
          expect(section.paragraphs.length, `${language} ${kind} ${section.heading}`).toBeGreaterThan(0);
          for (const paragraph of section.paragraphs) expect(paragraph.trim()).not.toBe("");
        }
      }
    }
  });

  it("shows Italian and English as written, and the English text with a notice elsewhere", () => {
    expect(legalFor("it")).toEqual({ language: "it", fallback: false });
    expect(legalFor("en")).toEqual({ language: "en", fallback: false });
    for (const locale of LOCALES.filter((item) => item !== "it" && item !== "en")) {
      expect(legalFor(locale)).toEqual({ language: "en", fallback: true });
    }
  });
});
