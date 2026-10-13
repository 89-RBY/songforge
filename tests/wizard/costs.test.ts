import { describe, expect, it } from "vitest";
import { creditsFor } from "@/features/wizard/costs";

const RATES = { marginMultiplier: 2.5, centsPerCredit: 10 };

describe("creditsFor", () => {
  it("charges nothing when the provider is free", () => {
    expect(creditsFor(0, RATES)).toBe(0);
  });

  it("applies the margin and rounds up to whole credits", () => {
    expect(creditsFor(4, RATES)).toBe(1); // clip: 4 cents x 2.5 = 10 cents = 1 credit
    expect(creditsFor(8, RATES)).toBe(2); // full song: 20 cents = 2 credits
    expect(creditsFor(3, RATES)).toBe(1); // 7.5 cents rounds up to 1 credit
    expect(creditsFor(5, RATES)).toBe(2); // 12.5 cents rounds up to 2 credits
  });

  it("follows the rates set by the operator", () => {
    expect(creditsFor(4, { marginMultiplier: 3, centsPerCredit: 5 })).toBe(3); // 12 cents / 5
  });
});
