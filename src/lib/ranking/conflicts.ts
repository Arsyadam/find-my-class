import { expandDays, intervalsOverlap, timeToMinutes } from "./time";

export interface TimedSection {
  days: string;
  start_time: string;
  end_time: string;
  class_nbr?: string;
  course_code?: string;
}

export function sectionsConflict(a: TimedSection, b: TimedSection): boolean {
  const daysA = expandDays(a.days);
  const daysB = expandDays(b.days);
  if (!daysA.length || !daysB.length) return false;

  const shareDay = daysA.some((d) => daysB.includes(d));
  if (!shareDay) return false;

  const aStart = timeToMinutes(a.start_time);
  const aEnd = timeToMinutes(a.end_time);
  const bStart = timeToMinutes(b.start_time);
  const bEnd = timeToMinutes(b.end_time);
  if (aStart == null || aEnd == null || bStart == null || bEnd == null) {
    return false;
  }

  return intervalsOverlap(aStart, aEnd, bStart, bEnd);
}

export function findConflicts(
  candidate: TimedSection,
  selected: TimedSection[],
): TimedSection[] {
  return selected.filter((s) => sectionsConflict(candidate, s));
}
