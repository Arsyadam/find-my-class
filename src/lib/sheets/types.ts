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
  days: string;
  start_time: string;
  end_time: string;
  location: string;
  status: string;
  seats_open: number | string;
  capacity: number | string;
  waitlist: number | string;
  instructor_ctclink: string;
  instructor_override: string;
  effective_instructor: string;
  enroll_url: string;
  last_synced: string;
  removed?: string | boolean;
}

export interface SheetProfessor {
  name: string;
  rmp_id: string;
  rmp_url: string;
  rating: number | string;
  difficulty: number | string;
  would_take_again: number | string;
  num_ratings: number | string;
  department: string;
  last_synced: string;
}

export interface SheetCourseStat {
  course_code: string;
  professor: string;
  rmp_id: string;
  rmp_url: string;
  course_quality: number | string;
  course_difficulty: number | string;
  course_would_take_again_pct: number | string;
  course_num_ratings: number | string;
  overall_rating: number | string;
  overall_difficulty: number | string;
  overall_would_take_again_pct: number | string;
  overall_num_ratings: number | string;
  last_review_date: string;
}

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
  sections: SheetSection[];
  professors: SheetProfessor[];
  courseStats: SheetCourseStat[];
  rankings: SheetRanking[];
  cachedAt?: string;
  source?: "live" | "fixture" | "cache";
}

export function num(v: number | string | null | undefined, fallback = 0): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  if (v == null || v === "") return fallback;
  const n = Number.parseFloat(String(v).replace(/%/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

/**
 * effective_instructor = instructor_override || instructor_ctclink
 * Never invent overrides; empty override falls through.
 */
export function effectiveInstructor(section: {
  instructor_override?: string | null;
  instructor_ctclink?: string | null;
  effective_instructor?: string | null;
}): string {
  const override = (section.instructor_override ?? "").trim();
  if (override) return override;
  const ctclink = (section.instructor_ctclink ?? "").trim();
  if (ctclink) return ctclink;
  return (section.effective_instructor ?? "").trim() || "Staff";
}
