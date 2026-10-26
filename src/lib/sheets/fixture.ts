import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SheetsApiResponse } from "./types";

export async function loadFixtureApi(
  termCode: string,
  courseCodes: string[],
): Promise<SheetsApiResponse> {
  const file = path.join(
    process.cwd(),
    "fixtures",
    `sheets-api-${termCode}.json`,
  );
  const raw = await readFile(file, "utf8");
  const data = JSON.parse(raw) as SheetsApiResponse;

  const wanted = new Set(
    courseCodes.map((c) => c.toUpperCase().replace(/\s+/g, " ")),
  );
  const filter = wanted.size > 0;

  return {
    ...data,
    source: "fixture",
    sections: filter
      ? data.sections.filter((s) =>
          wanted.has(s.course_code.toUpperCase().replace(/\s+/g, " ")),
        )
      : data.sections,
    rankings: filter
      ? data.rankings.filter((r) =>
          wanted.has(r.course_code.toUpperCase().replace(/\s+/g, " ")),
        )
      : data.rankings,
  };
}
