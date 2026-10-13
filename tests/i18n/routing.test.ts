import { describe, expect, it } from "vitest";
import { isLocale, localeFromPath, negotiateLocale } from "@/i18n/routing";

describe("locale routing", () => {
  it("reads the locale from the first path segment", () => {
    expect(localeFromPath("/it/create")).toBe("it");
    expect(localeFromPath("/fr")).toBe("fr");
    expect(localeFromPath("/create")).toBeNull();
    expect(localeFromPath("/")).toBeNull();
    expect(localeFromPath("/xx/create")).toBeNull();
  });

  it("accepts only the supported locales", () => {
    expect(isLocale("ro")).toBe(true);
    expect(isLocale("es")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it("prefers the visitor's saved choice over the browser language", () => {
    expect(negotiateLocale("de", "fr-FR,fr;q=0.9")).toBe("de");
  });

  it("ranks Accept-Language by quality value", () => {
    expect(negotiateLocale(undefined, "de;q=0.5,en;q=0.9")).toBe("en");
    expect(negotiateLocale(undefined, "fr-CH, fr;q=0.9, en;q=0.8")).toBe("fr");
  });

  it("skips unsupported languages and falls back to Italian", () => {
    expect(negotiateLocale(undefined, "es-ES,pt;q=0.8")).toBe("it");
    expect(negotiateLocale(undefined, null)).toBe("it");
    expect(negotiateLocale("xx", null)).toBe("it");
  });
});
