import {
  effectiveInstructor,
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

const STAFF_NAMES = new Set(["staff", "tba", "tbd", "instructor", ""]);

function isTba(section: SheetSection): boolean {
  const days = (section.days ?? "").trim();
  const start = (section.start_time ?? "").trim();
  return !days || /^tba$/i.test(days) || !start || /^tba$/i.test(start);
}

function isFull(section: SheetSection): boolean {
  const open = num(section.seats_open, 0);
  const status = String(section.status ?? "").toLowerCase();
  return open <= 0 || status.includes("closed") || status.includes("full");
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
  if (start == null || end == null) return true; // TBA handled via flags
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

  // Normalize WTA to 0-5 scale if it looks like a percent
  const wtaNorm = wta > 5 ? (wta / 100) * 5 : wta;

  let score =
    ((quality * wQ + easiness * wE + wtaNorm * wW) / wSum) * 20;

  const base = baseRank ? num(baseRank.score, 0) : 0;
  score = score * 0.7 + base * 0.3;

  score += dayPreferenceScore(section, prefs.preferDays, prefs.avoidDays);

  const instructor = effectiveInstructor(section);
  if (STAFF_NAMES.has(instructor.toLowerCase())) {
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
  if (quality) bits.push(`RMP ${quality.toFixed(1)}`);
  if (courseStat && num(courseStat.course_num_ratings, 0) > 0) {
    bits.push(`course reviews ${num(courseStat.course_num_ratings)}`);
  }
  if (prefs.preferDays.length) bits.push("day prefs applied");
  if (STAFF_NAMES.has(instructor.toLowerCase())) {
    bits.push("Staff/TBA ranked lower");
  }

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

  for (const courseCode of courseCodes) {
    const code = courseCode.toUpperCase().replace(/\s+/g, " ");
    const sections = data.sections.filter(
      (s) =>
        s.course_code.toUpperCase().replace(/\s+/g, " ") === code &&
        String(s.term_code) === String(prefs.termCode) &&
        !s.removed,
    );

    if (!sections.length) {
      results.push({
        courseCode: code,
        options: [],
        message: "Not offered (or not synced) for this term",
      });
      continue;
    }

    const rankings = data.rankings.filter(
      (r) =>
        r.course_code.toUpperCase().replace(/\s+/g, " ") === code &&
        String(r.term_code) === String(prefs.termCode),
    );

    const options: RankedOption[] = sections.map((section) => {
      const professorName = effectiveInstructor(section);
      const rmp = lookupProfessor(professorName, data.professors);
      const courseStat = lookupCourseStat(
        code,
        professorName,
        data.courseStats,
      );
      const baseRanking = rankings.find(
        (r) => String(r.class_nbr) === String(section.class_nbr),
      );
      const { score, reason } = personalScore(
        section,
        prefs,
        rmp,
        courseStat,
        baseRanking,
      );

      return {
        rank: 0,
        rankLabel: "",
        section,
        professorName,
        score,
        reason,
        rmp,
        courseStat,
        flags: {
          tba: isTba(section),
          conflict: false,
          full: isFull(section),
          notOffered: false,
          waitlist: num(section.waitlist, 0) > 0 && isFull(section),
        },
        enrollUrl: section.enroll_url || baseRanking?.enroll_url || "",
        rmpUrl: rmp?.rmp_url || baseRanking?.rmp_url || "",
        baseRanking,
      };
    });

    options.sort((a, b) => b.score - a.score);
    const top = options.slice(0, 3).map((opt, i) => ({
      ...opt,
      rank: i + 1,
      rankLabel: i === 0 ? "1st option" : i === 1 ? "2nd option" : "3rd option",
    }));

    // Mark conflicts among top picks relative to 1st
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
