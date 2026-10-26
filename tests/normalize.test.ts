import { describe, expect, it } from "vitest";
import { normalizeCourseTitle } from "@/lib/edplan/normalize";

describe("normalizeCourseTitle", () => {
  it("normalizes slash and ampersand forms", () => {
    expect(normalizeCourseTitle("ENGL&/101").courseCode).toBe("ENGL& 101");
    expect(normalizeCourseTitle("MATH& 152").courseCode).toBe("MATH& 152");
    expect(normalizeCourseTitle("POLS& 202 (ss)").courseCode).toBe("POLS& 202");
    expect(normalizeCourseTitle("ENGL 128").courseCode).toBe("ENGL 128");
  });

  it("flags placeholders as needsChoice", () => {
    const h = normalizeCourseTitle("Humanities/Social Science");
    expect(h.needsChoice).toBe(true);
    expect(h.courseCode).toBeNull();
    expect(normalizeCourseTitle("IP 1").needsChoice).toBe(true);
  });
});
