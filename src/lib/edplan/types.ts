export type TermCode = "2271" | "2273" | string;

export interface TermInfo {
  termCode: TermCode;
  termLabel: string;
  /** Publisher Edplan column suffix, e.g. `_3` → Winter 2027 */
  columnIndex: number;
}

export interface PlannedCourse {
  rawTitle: string;
  courseCode: string | null;
  subject: string | null;
  catalogNbr: string | null;
  credits: number | null;
  needsChoice: boolean;
  notes: string[];
  termCode: TermCode;
  termLabel: string;
  row: number;
}

export interface EdplanParseResult {
  terms: Record<string, PlannedCourse[]>;
  source: "acroform" | "positional" | "empty";
  warnings: string[];
}

export const KNOWN_TERMS: TermInfo[] = [
  { termCode: "2271", termLabel: "Winter 2027", columnIndex: 3 },
  { termCode: "2273", termLabel: "Spring 2027", columnIndex: 4 },
];

export const TERM_BY_COLUMN = Object.fromEntries(
  KNOWN_TERMS.map((t) => [t.columnIndex, t]),
) as Record<number, TermInfo>;

export const TERM_BY_CODE = Object.fromEntries(
  KNOWN_TERMS.map((t) => [t.termCode, t]),
) as Record<string, TermInfo>;
