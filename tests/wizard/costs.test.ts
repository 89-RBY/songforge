import { describe, expect, it } from "vitest";
import { creditsFor } from "@/features/wizard/costs";

describe("creditsFor", () => {
  it("charges nothing when the provider is free", () => {
    expect(creditsFor(0)).toBe(0);
  });

  it("applies the provisional margin and rounds up", () => {
    expect(creditsFor(4)).toBe(10); // clip: 4 cents x 2.5
    expect(creditsFor(8)).toBe(20); // full song: 8 cents x 2.5
    expect(creditsFor(3)).toBe(8); // 7.5 rounds up
  });
});
