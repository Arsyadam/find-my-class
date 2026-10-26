/** Denormalized section row from the Winter/Spring Apps Script bridge. */
export interface SheetSection {
  term_code: string;
  term: string;
  subject: string;
  catalog_nbr: string;
  course_code: string;
  title: string;
  section: string;
  class_nbr: string;
  component: string;
  instruction_mode: string;
  credits: number | string;
  session?: string;
  days: string;
  start_time: string;
  end_time: string;
  times_raw?: string;
  location: string;
  campus?: string;
  status: string;
  seats_open: number | string;
  capacity: number | string;
  enrolled?: number | string;
  waitlist: number | string;
  waitlist_cap?: number | string;
  /** ctcLink instructor (may be Staff/TBA) */
  instructor: string;
  /** @deprecated alias of instructor — kept for older fixtures */
  instructor_ctclink?: string;
  /** Always empty on the new sheet; never invent overrides */
  instructor_override?: string;
  effective_instructor?: string;
  staff_tba?: boolean;
  rmp_match?: string;
  match_confidence?: string;
  match_note?: string;
  rmp_overall?: number | string | null;
  rmp_difficulty?: number | string | null;
  rmp_would_take_again?: number | string | null;
  rmp_num_ratings?: number | string | null;
  rmp_course_quality?: number | string | null;
  rmp_course_difficulty?: number | string | null;
  rmp_course_wta?: number | string | null;
  rmp_course_num_ratings?: number | string | null;
  rmp_url?: string;
  /** Primary inferred name — informational only; never treat as confirmed */
  inferred_instructor?: string;
  inferred_instructor_raw?: string;
  inference_basis?: string;
  inferred_rmp_overall?: number | string | null;
  inferred_rmp_difficulty?: number | string | null;
  inferred_rmp_wta?: number | string | null;
  inferred_rmp_num_ratings?: number | string | null;
  inferred_rmp_url?: string;
  other_inferred_candidates?: string;
  enroll_url: string;
  details_link_check?: string;
  /** True only when sheet has a confirmed RMP match (not inferred) */
  rmp_confirmed?: boolean;
  removed?: string | boolean;
}

/** Legacy shape — optional; new API embeds RMP on each section. */
export interface SheetProfessor {
  name: string;
  rmp_id?: string;
  rmp_url: string;
  rating: number | string;
  difficulty: number | string;
  would_take_again: number | string;
  num_ratings: number | string;
  department?: string;
  last_synced?: string;
}

/** Legacy shape — optional. */
export interface SheetCourseStat {
  course_code: string;
  professor: string;
  rmp_id?: string;
  rmp_url?: string;
  course_quality: number | string;
  course_difficulty: number | string;
  course_would_take_again_pct: number | string;
  course_num_ratings: number | string;
  overall_rating?: number | string;
  overall_difficulty?: number | string;
  overall_would_take_again_pct?: number | string;
  overall_num_ratings?: number | string;
  last_review_date?: string;
}

/** Legacy Rankings tab — unused by the new sheet; may be empty. */
export interface SheetRanking {
  term_code: string;
  course_code: string;
  rank: number | string;
  rank_label: string;
  class_nbr: string;
  section: string;
  professor: string;
  score: number | string;
  reason: string;
  enroll_url: string;
  rmp_url: string;
  computed_at: string;
}

export interface SheetsApiResponse {
  term?: string;
  courses?: string[];
  tab?: string;
  sections: SheetSection[];
  /** Optional legacy arrays — new bridge omits these */
  professors?: SheetProfessor[];
  courseStats?: SheetCourseStat[];
  rankings?: SheetRanking[];
  cachedAt?: string;
  source?: "live" | "fixture" | "cache";
  error?: string;
}

export function num(v: number | string | null | undefined, fallback = 0): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  if (v == null || v === "") return fallback;
  const n = Number.parseFloat(String(v).replace(/%/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

const STAFF_NAMES = new Set(["staff", "tba", "tbd", "instructor", ""]);

export function isStaffName(name: string | null | undefined): boolean {
  return STAFF_NAMES.has(String(name ?? "").trim().toLowerCase());
}

/**
 * Display / ranking instructor for a section.
 * Confirmed ctcLink name only — never promotes inferred names.
 */
export function effectiveInstructor(section: {
  instructor?: string | null;
  instructor_override?: string | null;
  instructor_ctclink?: string | null;
  effective_instructor?: string | null;
  staff_tba?: boolean;
}): string {
  // Legacy override (old sheet / fixtures) — only if explicitly set
  const override = (section.instructor_override ?? "").trim();
  if (override) return override;

  const primary = (
    section.instructor ??
    section.instructor_ctclink ??
    section.effective_instructor ??
    ""
  ).trim();
  return primary || "Staff";
}

/** True when the sheet marks a confirmed (non-inferred) RMP match. */
export function hasConfirmedRmp(section: SheetSection): boolean {
  if (section.rmp_confirmed === true) return true;
  if (section.rmp_confirmed === false) return false;
  if (section.staff_tba) return false;
  const conf = String(section.match_confidence ?? "").toLowerCase();
  if (conf.includes("no match")) return false;
  const match = (section.rmp_match ?? "").trim();
  const overall = section.rmp_overall;
  const hasOverall =
    overall != null &&
    overall !== "" &&
    Number.isFinite(Number.parseFloat(String(overall)));
  return Boolean(match) || hasOverall;
}

/** Primary inferred instructor label (optional UX), never confirmed. */
export function inferredInstructorName(section: SheetSection): string {
  return (section.inferred_instructor ?? "").trim();
}
