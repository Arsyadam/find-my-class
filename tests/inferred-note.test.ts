import { describe, expect, it } from "vitest";
import { inferredStaffNote } from "@/lib/ranking/inferredNote";

describe("inferredStaffNote", () => {
  it("formats the short Staff + likely note", () => {
    expect(inferredStaffNote("Ann Modzelewski")).toBe(
      "Listed as Staff. Likely: Ann Modzelewski (unconfirmed).",
    );
  });

  it("handles empty names", () => {
    expect(inferredStaffNote("")).toBe("Listed as Staff.");
  });
});
