import {
  FMC_SHEET_ID,
  TERM_TABS,
  mapSheetRow,
  parseCsv,
} from "./mapRow";
import type { SheetsApiResponse } from "./types";

function sheetCsvUrl(sheetId: string, tabName: string): string {
  const u = new URL(
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq`,
  );
  u.searchParams.set("tqx", "out:csv");
  u.searchParams.set("sheet", tabName);
  return u.toString();
}

/**
 * Live read of the denormalized Winter/Spring tabs via public CSV export.
 * No Apps Script required — works when the sheet is link-readable.
 */
export async function fetchGoogleSheetCsv(options: {
  termCode: string;
  courseCodes: string[];
  sheetId?: string;
  revalidateSeconds?: number;
}): Promise<SheetsApiResponse> {
  const sheetId = options.sheetId ?? FMC_SHEET_ID;
  const tab =
    TERM_TABS[String(options.termCode)] ??
    (String(options.termCode) === "2271" ? "Winter 2027" : "Spring 2027");
  const revalidate = options.revalidateSeconds ?? 600;

  const res = await fetch(sheetCsvUrl(sheetId, tab), {
    next: { revalidate: Number.isFinite(revalidate) ? revalidate : 600 },
    headers: { Accept: "text/csv,*/*" },
  });

  if (!res.ok) {
    throw new Error(`Google Sheet CSV HTTP ${res.status} for tab "${tab}"`);
  }

  const text = await res.text();
  if (/^\s*<(!doctype|html)/i.test(text)) {
    throw new Error(
      `Google Sheet CSV returned HTML (sheet may not be shared publicly). Tab="${tab}"`,
    );
  }

  const wanted = new Set(
    options.courseCodes.map((c) => c.toUpperCase().replace(/\s+/g, " ")),
  );
  const filter = wanted.size > 0;

  const sections = parseCsv(text)
    .map((row) => mapSheetRow(row, { termFallback: options.termCode }))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .filter((s) => {
      if (String(s.term_code) && String(s.term_code) !== String(options.termCode)) {
        return false;
      }
      if (!filter) return true;
      return wanted.has(s.course_code.toUpperCase().replace(/\s+/g, " "));
    });

  return {
    term: options.termCode,
    courses: options.courseCodes,
    tab,
    sections,
    cachedAt: new Date().toISOString(),
    source: "live",
  };
}
