import { de } from "./dictionaries/de";
import { en } from "./dictionaries/en";
import { fr } from "./dictionaries/fr";
import { it, type Dictionary } from "./dictionaries/it";
import { ro } from "./dictionaries/ro";
import type { Locale } from "./routing";

const DICTIONARIES: Record<Locale, Dictionary> = { it, en, ro, de, fr };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

// Replaces {name} placeholders. Unknown placeholders are left as they are, so a missing value is visible.
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
