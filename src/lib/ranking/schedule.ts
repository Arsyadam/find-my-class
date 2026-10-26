import { num } from "@/lib/sheets";
import { findConflicts } from "./conflicts";
import type {
  BuiltSchedule,
  CourseRecommendation,
  ScheduleBlock,
  UserPreferences,
} from "./types";

/**
 * Build a conflict-free weekly schedule using 1st options, falling back to 2nd/3rd.
 */
export function buildSchedule(
  recommendations: CourseRecommendation[],
  prefs: UserPreferences,
): BuiltSchedule {
  const blocks: ScheduleBlock[] = [];
  const usedFallbacks: BuiltSchedule["usedFallbacks"] = [];
  const unresolved: string[] = [];
  let totalCredits = 0;

  for (const rec of recommendations) {
    if (!rec.options.length) {
      unresolved.push(rec.courseCode);
      continue;
    }

    let placed = false;
    for (let i = 0; i < rec.options.length; i++) {
      const opt = rec.options[i];
      const conflicts = findConflicts(
        opt.section,
        blocks.map((b) => ({
          days: b.days,
          start_time: b.startTime,
          end_time: b.endTime,
          class_nbr: b.classNbr,
          course_code: b.courseCode,
        })),
      );
      if (conflicts.length) continue;

      const credits = num(opt.section.credits, 0);
      if (totalCredits + credits > prefs.maxCredits && credits > 0) {
        continue;
      }

      blocks.push({
        courseCode: rec.courseCode,
        section: opt.section.section,
        classNbr: String(opt.section.class_nbr),
        professor: opt.professorName,
        days: opt.section.days,
        startTime: opt.section.start_time,
        endTime: opt.section.end_time,
        location: opt.section.location,
        fallbackRank: opt.rank,
      });
      totalCredits += credits;
      if (i > 0) {
        usedFallbacks.push({
          courseCode: rec.courseCode,
          fromRank: 1,
          toRank: opt.rank,
        });
      }
      placed = true;
      break;
    }

    if (!placed) unresolved.push(rec.courseCode);
  }

  return { blocks, usedFallbacks, unresolved, totalCredits };
}
