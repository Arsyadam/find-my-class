import type {
  SheetCourseStat,
  SheetProfessor,
  SheetRanking,
  SheetSection,
} from "@/lib/sheets/types";

export interface UserPreferences {
  termCode: string;
  earliestTime: string; // "08:00"
  latestTime: string; // "21:00"
  preferDays: string[]; // ["M","W","F"]
  avoidDays: string[];
  modes: string[]; // ["In Person","Online","Hybrid"] empty = any
  maxCredits: number;
  weightQuality: number; // 0-100
  weightEasiness: number;
  weightWouldTakeAgain: number;
}

export interface RankedOption {
  rank: number;
  rankLabel: string;
  section: SheetSection;
  professorName: string;
  score: number;
  reason: string;
  rmp?: SheetProfessor;
  courseStat?: SheetCourseStat;
  flags: {
    tba: boolean;
    conflict: boolean;
    full: boolean;
    notOffered: boolean;
    waitlist: boolean;
  };
  enrollUrl: string;
  rmpUrl: string;
  baseRanking?: SheetRanking;
}

export interface CourseRecommendation {
  courseCode: string;
  options: RankedOption[];
  needsChoice?: boolean;
  message?: string;
}

export interface ScheduleBlock {
  courseCode: string;
  section: string;
  classNbr: string;
  professor: string;
  days: string;
  startTime: string;
  endTime: string;
  location: string;
  fallbackRank: number;
}

export interface BuiltSchedule {
  blocks: ScheduleBlock[];
  usedFallbacks: { courseCode: string; fromRank: number; toRank: number }[];
  unresolved: string[];
  totalCredits: number;
}
