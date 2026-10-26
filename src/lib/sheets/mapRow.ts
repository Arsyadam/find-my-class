import type { SheetSection } from "./types";

export const FMC_SHEET_ID =
  process.env.SHEETS_SPREADSHEET_ID?.trim() ||
  "13iJQzRF4nPt-ri33CZkkJs57YtpEzpR3nh8CMverTjw";

export const TERM_TABS: Record<string, string> = {
  "2271": "Winter 2027",
  "2273": "Spring 2027",
};

const STAFF_NAMES = new Set(["staff", "tba", "tbd", "instructor", ""]);

export function parseTimes(timesRaw: string | null | undefined): {
  start_time: string;
  end_time: string;
  times_raw: string;
} {
  const raw = String(timesRaw ?? "").trim();
  if (!raw || /^tba$/i.test(raw) || /^arr$/i.test(raw)) {
    return { start_time: "", end_time: "", times_raw: raw };
  }
  const parts = raw
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);
  const starts: string[] = [];
  const ends: string[] = [];
  for (const p of parts) {
    const m = p.match(
      /^(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*[-–—]\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)$/i,
    );
    if (m) {
      starts.push(m[1].replace(/\s+/g, " ").trim());
      ends.push(m[2].replace(/\s+/g, " ").trim());
    }
  }
  if (!starts.length) return { start_time: "", end_time: "", times_raw: raw };
  return { start_time: starts[0], end_time: ends[0], times_raw: raw };
}

export function primaryInferred(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  if (!s || /^no inference/i.test(s)) return "";
  const first = s.split(";")[0].trim();
  return first
    .replace(/\s*\(inferred,\s*not confirmed\)\s*/gi, "")
    .replace(/\s*\(inferred\)\s*/gi, "")
    .trim();
}

export function catalogFromCourse(courseCode: string): {
  subject: string;
  catalog_nbr: string;
} {
  const s = courseCode.trim();
  const m = s.match(/^(.+?)\s+(\S+)$/);
  if (!m) return { subject: s, catalog_nbr: "" };
  return { subject: m[1], catalog_nbr: m[2] };
}

function blankToNull(v: unknown): number | string | null {
  if (v === "" || v == null) return null;
  if (typeof v === "number" && Number.isNaN(v)) return null;
  const n = Number.parseFloat(String(v).replace(/%/g, ""));
  if (Number.isFinite(n) && String(v).trim() !== "") {
    // Keep numeric when it looks numeric
    if (/^-?\d+(\.\d+)?%?$/.test(String(v).trim())) return n;
  }
  return v as string | number;
}

function isTruthyStaff(v: unknown): boolean {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  return s === "yes" || s === "true" || s === "y" || s === "1";
}

function isStaffName(name: string): boolean {
  return STAFF_NAMES.has(name.trim().toLowerCase());
}

/** Map a denormalized sheet row (human headers) → SheetSection */
export function mapSheetRow(
  row: Record<string, string>,
  opts?: { termFallback?: string },
): SheetSection | null {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      if (row[k] != null && String(row[k]).length) return String(row[k]);
      // case-insensitive fallback
      const found = Object.keys(row).find(
        (h) => h.trim().toLowerCase() === k.trim().toLowerCase(),
      );
      if (found != null && String(row[found]).length) return String(row[found]);
    }
    return "";
  };

  const courseCode = get("Course", "course_code").trim();
  const classNbr = get("Class #", "class_nbr").trim();
  if (!courseCode && !classNbr) return null;

  const times = parseTimes(get("Times", "times_raw"));
  const catalog = catalogFromCourse(courseCode);
  const instructor =
    get("Instructor(s) (ctcLink)", "instructor", "instructor_ctclink").trim() ||
    "Staff";
  const staffTba =
    isTruthyStaff(get("Staff/TBA?", "staff_tba")) || isStaffName(instructor);
  const inferredRaw = get(
    "Likely instructor (inferred, NOT confirmed)",
    "inferred_instructor_raw",
  ).trim();
  const inferredPrimary = primaryInferred(inferredRaw);
  const matchConfidence = get("Match confidence", "match_confidence").trim();
  const rmpMatch = get("RMP match", "rmp_match").trim();
  const rmpOverall = blankToNull(get("RMP overall", "rmp_overall"));
  const confLower = matchConfidence.toLowerCase();
  const rmpConfirmed =
    !staffTba &&
    !confLower.includes("no match") &&
    (Boolean(rmpMatch) || rmpOverall != null);

  const termCode =
    get("Term code", "term_code").trim() || opts?.termFallback || "";
  const enroll =
    get("ctcLink class details link", "enroll_url").trim() ||
    (classNbr && termCode
      ? `https://csprd.ctclink.us/psc/csprd/EMPLOYEE/SA/s/WEBLIB_HCX_CM.H_CLASS_DETAILS.FieldFormula.IScript_Main?institution=WA100&x_term=${encodeURIComponent(termCode)}&class_nbr=${encodeURIComponent(classNbr)}`
      : "");

  return {
    term_code: termCode,
    term: get("Term", "term").trim(),
    subject: get("Subject", "subject").trim() || catalog.subject,
    catalog_nbr: catalog.catalog_nbr,
    course_code: courseCode,
    title: get("Title", "title").trim(),
    section: get("Section", "section").trim(),
    class_nbr: classNbr,
    component: get("Component", "component").trim(),
    instruction_mode: get("Instruction mode", "instruction_mode").trim(),
    credits: blankToNull(get("Credits", "credits")) ?? "",
    session: get("Session", "session").trim(),
    days: get("Days", "days").trim(),
    start_time: times.start_time,
    end_time: times.end_time,
    times_raw: times.times_raw,
    location: get("Location / room", "location").trim(),
    campus: get("Campus", "campus").trim(),
    status: get("Status", "status").trim(),
    seats_open: blankToNull(get("Seats open", "seats_open")) ?? "",
    capacity: blankToNull(get("Capacity", "capacity")) ?? "",
    enrolled: blankToNull(get("Enrolled", "enrolled")) ?? undefined,
    waitlist: blankToNull(get("Waitlist", "waitlist")) ?? 0,
    waitlist_cap:
      blankToNull(get("Waitlist cap", "waitlist_cap")) ?? undefined,
    instructor,
    instructor_ctclink: instructor,
    instructor_override: "",
    effective_instructor: instructor,
    staff_tba: staffTba,
    rmp_match: rmpMatch,
    match_confidence: matchConfidence,
    match_note: get("Match note", "match_note").trim(),
    rmp_overall: rmpOverall,
    rmp_difficulty: blankToNull(get("RMP difficulty", "rmp_difficulty")),
    rmp_would_take_again: blankToNull(
      get("RMP would take again %", "rmp_would_take_again"),
    ),
    rmp_num_ratings: blankToNull(get("RMP # ratings", "rmp_num_ratings")),
    rmp_course_quality: blankToNull(
      get("RMP this-course quality", "rmp_course_quality"),
    ),
    rmp_course_difficulty: blankToNull(
      get("RMP this-course difficulty", "rmp_course_difficulty"),
    ),
    rmp_course_wta: blankToNull(
      get("RMP this-course WTA %", "rmp_course_wta"),
    ),
    rmp_course_num_ratings: blankToNull(
      get("RMP this-course # ratings", "rmp_course_num_ratings"),
    ),
    rmp_url: get("RMP URL", "rmp_url").trim(),
    inferred_instructor: inferredPrimary,
    inferred_instructor_raw: inferredRaw,
    inference_basis: get("Inference basis", "inference_basis").trim(),
    inferred_rmp_overall: blankToNull(
      get("Inferred #1 RMP overall", "inferred_rmp_overall"),
    ),
    inferred_rmp_difficulty: blankToNull(
      get("Inferred #1 RMP difficulty", "inferred_rmp_difficulty"),
    ),
    inferred_rmp_wta: blankToNull(
      get("Inferred #1 RMP WTA %", "inferred_rmp_wta"),
    ),
    inferred_rmp_num_ratings: blankToNull(
      get("Inferred #1 RMP # ratings", "inferred_rmp_num_ratings"),
    ),
    inferred_rmp_url: get("Inferred #1 RMP URL", "inferred_rmp_url").trim(),
    other_inferred_candidates: get(
      "Other inferred candidates",
      "other_inferred_candidates",
    ).trim(),
    enroll_url: enroll,
    details_link_check: get("Details link check", "details_link_check").trim(),
    rmp_confirmed: rmpConfirmed,
    removed: false,
  };
}

/** Minimal CSV parser that handles quoted fields with commas/newlines. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;
  const s = text.replace(/^\uFEFF/, "");

  while (i < s.length) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((c) => c.length)) rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.some((c) => c.length)) rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cols) => {
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = cols[c] ?? "";
    }
    return obj;
  });
}
