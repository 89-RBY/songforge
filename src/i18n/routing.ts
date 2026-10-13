export const LOCALES = ["it", "en", "ro", "de", "fr"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "it";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const LOCALE_NAMES: Record<Locale, string> = {
  it: "Italiano",
  en: "English",
  ro: "Română",
  de: "Deutsch",
  fr: "Français",
};

export function isLocale(value: string | null | undefined): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function localeFromPath(pathname: string): Locale | null {
  const first = pathname.split("/")[1];
  return isLocale(first) ? first : null;
}

// The cookie wins: it stores the choice the visitor made. Otherwise Accept-Language, ranked by q-values.
export function negotiateLocale(cookieValue: string | undefined, acceptLanguage: string | null): Locale {
  if (isLocale(cookieValue)) return cookieValue;
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [range, ...params] = part.trim().split(";");
      const qParam = params.find((param) => param.trim().startsWith("q="));
      const parsed = qParam ? Number(qParam.trim().slice(2)) : 1;
      return {
        language: (range ?? "").trim().toLowerCase().split("-")[0] ?? "",
        quality: Number.isNaN(parsed) ? 0 : parsed,
      };
    })
    .sort((a, b) => b.quality - a.quality);

  const match = ranked.find((entry) => isLocale(entry.language));
  return match ? (match.language as Locale) : DEFAULT_LOCALE;
}
