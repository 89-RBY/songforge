import { describe, expect, it } from "vitest";
import { getDictionary } from "@/i18n";
import { LOCALES } from "@/i18n/routing";

type Tree = { [key: string]: string | string[] | Tree };

// Flattens a dictionary into "path" -> value pairs, so a missing or extra key is reported by name.
function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else if (Array.isArray(value)) value.forEach((item, i) => out.set(`${path}[${i}]`, item));
    else for (const [subPath, subValue] of flatten(value, path)) out.set(subPath, subValue);
  }
  return out;
}

const reference = flatten(getDictionary("it") as unknown as Tree);

describe.each(LOCALES)("dictionary %s", (locale) => {
  const dict = flatten(getDictionary(locale) as unknown as Tree);

  it("has exactly the same keys as Italian", () => {
    expect([...dict.keys()].sort()).toEqual([...reference.keys()].sort());
  });

  it("has no empty strings", () => {
    const empty = [...dict].filter(([, value]) => value.trim() === "").map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it("keeps the same {placeholders} as Italian", () => {
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const [key, value] of reference) {
      expect(placeholders(dict.get(key) ?? ""), key).toEqual(placeholders(value));
    }
  });
});
