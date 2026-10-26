import { PDFDocument } from "pdf-lib";
import {
  TERM_BY_COLUMN,
  type EdplanParseResult,
  type PlannedCourse,
} from "./types";
import { normalizeCourseTitle } from "./normalize";

const CLASS_TITLE_RE = /^Class Title ie ENGL 101Row(\d+)_(\d+)$/i;
const CREDITS_RE = /^CreditsRow(\d+)_(\d+)$/i;

function parseCredits(value: string): number | null {
  const n = Number.parseFloat(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse a GRC Publisher Educational Plan PDF in memory.
 * Prefers AcroForm fields (`Class Title ie ENGL 101Row{row}_{col}`);
 * falls back to a lightweight positional heuristic when no titles are found.
 */
export async function parseEdplanPdf(
  bytes: Uint8Array,
): Promise<EdplanParseResult> {
  const warnings: string[] = [];
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });

  const titles = new Map<string, string>();
  const credits = new Map<string, number | null>();

  try {
    const form = pdf.getForm();
    for (const field of form.getFields()) {
      const name = field.getName();
      let value = "";
      try {
        // pdf-lib TextField
        const maybe = field as { getText?: () => string };
        if (typeof maybe.getText === "function") {
          value = maybe.getText() ?? "";
        }
      } catch {
        // non-text field
      }
      const trimmed = value.trim();
      if (!trimmed) continue;

      const titleMatch = name.match(CLASS_TITLE_RE);
      if (titleMatch) {
        titles.set(`${titleMatch[1]}_${titleMatch[2]}`, trimmed);
        continue;
      }
      const creditMatch = name.match(CREDITS_RE);
      if (creditMatch) {
        credits.set(
          `${creditMatch[1]}_${creditMatch[2]}`,
          parseCredits(trimmed),
        );
      }
    }
  } catch (err) {
    warnings.push(
      `AcroForm read failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (titles.size === 0) {
    warnings.push(
      "No AcroForm class-title fields found; positional text fallback is limited in this build (use a Publisher Edplan PDF with form fields).",
    );
    return { terms: {}, source: "empty", warnings };
  }

  const terms: Record<string, PlannedCourse[]> = {};

  for (const [key, rawTitle] of titles) {
    const [rowStr, colStr] = key.split("_");
    const row = Number(rowStr);
    const col = Number(colStr);
    const term = TERM_BY_COLUMN[col];
    if (!term) continue;

    const norm = normalizeCourseTitle(rawTitle);
    const course: PlannedCourse = {
      rawTitle,
      courseCode: norm.courseCode,
      subject: norm.subject,
      catalogNbr: norm.catalogNbr,
      credits: credits.get(key) ?? null,
      needsChoice: norm.needsChoice,
      notes: norm.notes,
      termCode: term.termCode,
      termLabel: term.termLabel,
      row,
    };

    if (!terms[term.termCode]) terms[term.termCode] = [];
    terms[term.termCode].push(course);
  }

  for (const list of Object.values(terms)) {
    list.sort((a, b) => a.row - b.row);
  }

  return { terms, source: "acroform", warnings };
}
