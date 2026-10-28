import { describe, expect, it } from "vitest";
import { EFFORT_WEIGHTS, TERM_OPTIONS } from "@/lib/motion";
import { cn } from "@/lib/utils";

describe("effort weight presets", () => {
  it("maps low to easiness-heavy", () => {
    expect(EFFORT_WEIGHTS.low.weightEasiness).toBeGreaterThan(
      EFFORT_WEIGHTS.low.weightQuality,
    );
  });

  it("maps max to quality-heavy", () => {
    expect(EFFORT_WEIGHTS.max.weightQuality).toBeGreaterThan(
      EFFORT_WEIGHTS.max.weightEasiness,
    );
  });

  it("exposes Winter and Spring 2027 terms", () => {
    expect(TERM_OPTIONS.map((t) => t.label)).toEqual([
      "Winter 2027",
      "Spring 2027",
    ]);
  });
});

describe("cn", () => {
  it("merges tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
