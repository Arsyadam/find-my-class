import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseEdplanPdf } from "@/lib/edplan/parse";
import { validateEdplanPdf } from "@/lib/edplan/validate";

const fixture = path.join(process.cwd(), "fixtures", "synthetic-edplan.pdf");

describe("parseEdplanPdf", () => {
  it("parses Winter/Spring 2027 courses from synthetic AcroForm fixture", async () => {
    const bytes = new Uint8Array(readFileSync(fixture));
    validateEdplanPdf(bytes, "application/pdf");
    const result = await parseEdplanPdf(bytes);

    expect(result.source).toBe("acroform");

    const winter = result.terms["2271"].map((c) => c.courseCode);
    expect(winter).toEqual([
      "ENGL 128",
      "POLS& 202",
      "CHEM& 161",
      "ENGR 100",
    ]);

    const spring = result.terms["2273"].map((c) => c.courseCode);
    expect(spring).toEqual([
      "MATH& 152",
      "CHEM& 162",
      "PHYS& 221",
      "ENGR 106",
    ]);
  });
});
