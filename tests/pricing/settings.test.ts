import { describe, expect, it } from "vitest";
import { DEFAULT_PRICING, findPackage, parsePricing, pricingSchema } from "@/server/pricing/settings";

describe("pricing settings", () => {
  it("ships valid defaults", () => {
    expect(pricingSchema.safeParse(DEFAULT_PRICING).success).toBe(true);
  });

  it("falls back to the defaults when the stored value is invalid", () => {
    expect(parsePricing(null)).toEqual(DEFAULT_PRICING);
    expect(parsePricing({ marginMultiplier: 0.5 })).toEqual(DEFAULT_PRICING);
  });

  it("keeps a valid stored value", () => {
    const custom = { ...DEFAULT_PRICING, centsPerCredit: 20, disabledProviders: ["lyria"] };
    expect(parsePricing(custom)).toEqual(custom);
  });

  it("rejects duplicate package ids", () => {
    const duplicated = { ...DEFAULT_PRICING, packages: [DEFAULT_PRICING.packages[0], DEFAULT_PRICING.packages[0]] };
    expect(pricingSchema.safeParse(duplicated).success).toBe(false);
  });

  it("rejects package ids with unsafe characters and non-positive amounts", () => {
    const badId = { ...DEFAULT_PRICING, packages: [{ id: "Pacco 1", credits: 10, priceCents: 100 }] };
    const badPrice = { ...DEFAULT_PRICING, packages: [{ id: "ok", credits: 10, priceCents: 0 }] };
    expect(pricingSchema.safeParse(badId).success).toBe(false);
    expect(pricingSchema.safeParse(badPrice).success).toBe(false);
  });

  it("finds a package by id", () => {
    expect(findPackage(DEFAULT_PRICING, "plus")?.credits).toBe(100);
    expect(findPackage(DEFAULT_PRICING, "missing")).toBeUndefined();
  });
});
