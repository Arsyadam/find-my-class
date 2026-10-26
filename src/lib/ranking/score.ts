import {
  effectiveInstructor,
  hasConfirmedRmp,
  inferredInstructorName,
  isStaffName,
  num,
  type SheetCourseStat,
  type SheetProfessor,
  type SheetRanking,
  type SheetSection,
  type SheetsApiResponse,
} from "@/lib/sheets";
import { expandDays, timeToMinutes } from "./time";
import { findConflicts } from "./conflicts";
import type {
  CourseRecommendation,
  RankedOption,
  UserPreferences,
} from "./types";

function isTba(section: SheetSection): boolean {
  const days = (section.days ?? "").trim();
  const start = (section.start_time ?? "").trim();
  return (
    !days ||
    /^tba$/i.test(days) ||
    /^arr$/i.test(days) ||
    !start ||
    /^tba$/i.test(start)
  );
}

function isFull(section: SheetSection): boolean {
  const open = num(section.seats_open, 0);
  const status = String(section.status ?? "").toLowerCase();
  return open <= 0 || status.includes("closed") || status.includes("full");
}

function isStaffSection(section: SheetSection): boolean {
  if (section.staff_tba) return true;
  return isStaffName(effectiveInstructor(section));
}

function modeMatches(section: SheetSection, modes: string[]): boolean {
  if (!modes.length) return true;
  const mode = String(section.instruction_mode ?? "").toLowerCase();
  return modes.some((m) => mode.includes(m.toLowerCase()));
}

function withinTimeWindow(
  section: SheetSection,
  earliest: string,
  latest: string,
): boolean {
  const start = timeToMinutes(section.start_time);
  const end = timeToMinutes(section.end_time);
  if (start == null || end == null) return true; // TBA/ARR handled via flags
  const min = timeToMinutes(earliest) ?? 0;
  const max = timeToMinutes(latest) ?? 24 * 60;
  return start >= min && end <= max;
}

function dayPreferenceScore(
  section: SheetSection,
  prefer: string[],
  avoid: string[],
): number {
  const days = expandDays(section.days);
  if (!days.length) return 0;
  let score = 0;
  for (const d of days) {
    if (prefer.includes(d)) score += 2;
    if (avoid.includes(d)) score -= 4;
  }
  return score;
}

function rmpFromSection(
  section: SheetSection,
): { rmp?: SheetProfessor; courseStat?: SheetCourseStat; inferredOnly: boolean } {
  const confirmed = hasConfirmedRmp(section);
  if (confirmed) {
    const name =
      (section.rmp_match ?? "").trim() || effectiveInstructor(section);
    const rmp: SheetProfessor = {
      name,
      rmp_url: section.rmp_url ?? "",
      rating: section.rmp_overall ?? 0,
      difficulty: section.rmp_difficulty ?? 3,
      would_take_again: section.rmp_would_take_again ?? 0,
      num_ratings: section.rmp_num_ratings ?? 0,
    };
    const hasCourse = num(section.rmp_course_num_ratings, 0) > 0 ||
      (section.rmp_course_quality != null && section.rmp_course_quality !== "");
    const courseStat: SheetCourseStat | undefined = hasCourse
      ? {
          course_code: section.course_code,
          professor: name,
          rmp_url: section.rmp_url,
          course_quality: section.rmp_course_quality ?? 0,
          course_difficulty: section.rmp_course_difficulty ?? 3,
          course_would_take_again_pct: section.rmp_course_wta ?? 0,
          course_num_ratings: section.rmp_course_num_ratings ?? 0,
          overall_rating: section.rmp_overall ?? 0,
          overall_difficulty: section.rmp_difficulty ?? 3,
          overall_would_take_again_pct: section.rmp_would_take_again ?? 0,
          overall_num_ratings: section.rmp_num_ratings ?? 0,
        }
      : undefined;
    return { rmp, courseStat, inferredOnly: false };
  }

  // Inferred RMP is optional soft signal only — never confirmed
  const inferred = inferredInstructorName(section);
  const hasInferredRmp =
    inferred &&
    section.inferred_rmp_overall != null &&
    section.inferred_rmp_overall !== "";
  if (hasInferredRmp) {
    return {
      rmp: {
        name: inferred,
        rmp_url: section.inferred_rmp_url ?? "",
        rating: section.inferred_rmp_overall ?? 0,
        difficulty: section.inferred_rmp_difficulty ?? 3,
        would_take_again: section.inferred_rmp_wta ?? 0,
        num_ratings: section.inferred_rmp_num_ratings ?? 0,
      },
      inferredOnly: true,
    };
  }

  return { inferredOnly: Boolean(inferred) };
}

function lookupProfessor(
  name: string,
  professors: SheetProfessor[],
): SheetProfessor | undefined {
  const n = name.trim().toLowerCase();
  return professors.find((p) => p.name.trim().toLowerCase() === n);
}

function lookupCourseStat(
  courseCode: string,
  professor: string,
  stats: SheetCourseStat[],
): SheetCourseStat | undefined {
  const c = courseCode.toUpperCase();
  const p = professor.trim().toLowerCase();
  return stats.find(
    (s) =>
      s.course_code.toUpperCase() === c &&
      s.professor.trim().toLowerCase() === p,
  );
}

export function personalScore(
  section: SheetSection,
  prefs: UserPreferences,
  rmp: SheetProfessor | undefined,
  courseStat: SheetCourseStat | undefined,
  baseRank: SheetRanking | undefined,
  options?: { inferredOnly?: boolean; staff?: boolean },
): { score: number; reason: string } {
  const wQ = prefs.weightQuality / 100;
  const wE = prefs.weightEasiness / 100;
  const wW = prefs.weightWouldTakeAgain / 100;
  const wSum = Math.max(wQ + wE + wW, 0.01);

  const quality = courseStat
    ? num(courseStat.course_quality, num(courseStat.overall_rating, 0))
    : num(rmp?.rating, 0);
  const difficulty = courseStat
    ? num(courseStat.course_difficulty, num(courseStat.overall_difficulty, 3))
    : num(rmp?.difficulty, 3);
  const easiness = Math.max(0, 5 - difficulty);
  const wta = courseStat
    ? num(
        courseStat.course_would_take_again_pct,
        num(courseStat.overall_would_take_again_pct, 0),
      )
    : num(rmp?.would_take_again, 0);

  const wtaNorm = wta > 5 ? (wta / 100) * 5 : wta;

  let score =
    ((quality * wQ + easiness * wE + wtaNorm * wW) / wSum) * 20;

  // Inferred RMP gets lower weight — never treated as confirmed
  if (options?.inferredOnly) {
    score *= 0.35;
  }

  const base = baseRank ? num(baseRank.score, 0) : 0;
  if (base) score = score * 0.7 + base * 0.3;

  score += dayPreferenceScore(section, prefs.preferDays, prefs.avoidDays);

  if (options?.staff) {
    score -= 15;
  }

  if (!withinTimeWindow(section, prefs.earliestTime, prefs.latestTime)) {
    score -= 25;
  }

  if (!modeMatches(section, prefs.modes)) {
    score -= 40;
  }

  if (isFull(section)) score -= 8;

  const bits: string[] = [];
  if (baseRank?.reason) bits.push(String(baseRank.reason));
  if (quality && !options?.inferredOnly) {
    bits.push(`RMP ${quality.toFixed(1)}`);
  }
  if (quality && options?.inferredOnly) {
    bits.push(`inferred RMP ~${quality.toFixed(1)} (unconfirmed)`);
  }
  if (courseStat && num(courseStat.course_num_ratings, 0) > 0) {
    bits.push(`course reviews ${num(courseStat.course_num_ratings)}`);
  }
  if (prefs.preferDays.length) bits.push("day prefs applied");
  if (options?.staff) bits.push("Staff/TBA ranked lower");
  if (options?.inferredOnly) bits.push("inferred instructor only");

  return {
    score: Math.round(score * 10) / 10,
    reason: bits.slice(0, 3).join(" · ") || "Preference-weighted score",
  };
}

export function recommendCourses(
  courseCodes: string[],
  data: SheetsApiResponse,
  prefs: UserPreferences,
): CourseRecommendation[] {
  const results: CourseRecommendation[] = [];
  const professors = data.professors ?? [];
  const courseStats = data.courseStats ?? [];
  const rankings = data.rankings ?? [];

  for (const courseCode of courseCodes) {
    const code = courseCode.toUpperCase().replace(/\s+/g, " ");
    const sections = data.sections.filter(
      (s) =>
        s.course_code.toUpperCase().replace(/\s+/g, " ") === code &&
        String(s.term_code) === String(prefs.termCode) &&
        !(s.removed === true || String(s.removed).toUpperCase() === "TRUE"),
    );

    if (!sections.length) {
      results.push({
        courseCode: code,
        options: [],
        message: "Not offered (or not in sheet) for this term",
      });
      continue;
    }

    const courseRankings = rankings.filter(
      (r) =>
        r.course_code.toUpperCase().replace(/\s+/g, " ") === code &&
        String(r.term_code) === String(prefs.termCode),
    );

    const options: RankedOption[] = sections.map((section) => {
      const professorName = effectiveInstructor(section);
      const staff = isStaffSection(section);
      const fromSection = rmpFromSection(section);
      const rmp =
        fromSection.rmp ??
        (!fromSection.inferredOnly
          ? lookupProfessor(professorName, professors)
          : undefined);
      const courseStat =
        fromSection.courseStat ??
        (!fromSection.inferredOnly
          ? lookupCourseStat(code, professorName, courseStats)
          : undefined);
      const baseRanking = courseRankings.find(
        (r) => String(r.class_nbr) === String(section.class_nbr),
      );
      const inferredOnly = fromSection.inferredOnly;
      const inferred = inferredInstructorName(section);

      const { score, reason } = personalScore(
        section,
        prefs,
        rmp,
        courseStat,
        baseRanking,
        { inferredOnly, staff },
      );

      return {
        rank: 0,
        rankLabel: "",
        section,
        professorName,
        score,
        reason,
        rmp: inferredOnly ? undefined : rmp,
        courseStat,
        flags: {
          tba: isTba(section),
          conflict: false,
          full: isFull(section),
          notOffered: false,
          waitlist: num(section.waitlist, 0) > 0 && isFull(section),
          inferred: inferredOnly || (staff && Boolean(inferred)),
          staff,
        },
        enrollUrl: section.enroll_url || baseRanking?.enroll_url || "",
        rmpUrl:
          (!inferredOnly && (rmp?.rmp_url || section.rmp_url)) ||
          baseRanking?.rmp_url ||
          "",
        baseRanking,
        inferredInstructor: inferred || undefined,
      };
    });

    options.sort((a, b) => b.score - a.score);
    const top = options.slice(0, 3).map((opt, i) => ({
      ...opt,
      rank: i + 1,
      rankLabel: i === 0 ? "1st option" : i === 1 ? "2nd option" : "3rd option",
    }));

    if (top[0]) {
      for (let i = 1; i < top.length; i++) {
        const conflicts = findConflicts(top[i].section, [top[0].section]);
        if (conflicts.length) top[i].flags.conflict = true;
      }
    }

    results.push({ courseCode: code, options: top });
  }

  return results;
}
