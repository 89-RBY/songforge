import { describe, expect, it } from "vitest";
import { computePeaks } from "@/features/songs/peaks";

describe("computePeaks", () => {
  it("returns one normalised height per bar", () => {
    const samples = new Float32Array([0, 0.5, -1, 0.25, 0.1, 0.1, 0.2, 0.2]);
    expect(computePeaks(samples, 4)).toEqual([0.5, 1, 0.1, 0.2]);
  });

  it("returns nothing for empty input", () => {
    expect(computePeaks([], 10)).toEqual([]);
    expect(computePeaks([1, 2], 0)).toEqual([]);
  });

  it("keeps silence as zeros instead of dividing by zero", () => {
    expect(computePeaks([0, 0, 0, 0], 2)).toEqual([0, 0]);
  });
});
