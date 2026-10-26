import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  effectiveInstructor,
  hasConfirmedRmp,
  inferredInstructorName,
} from "@/lib/sheets/types";
import {
  buildSchedule,
  expandDays,
  recommendCourses,
  sectionsConflict,
} from "@/lib/ranking";
import type { SheetsApiResponse } from "@/lib/sheets";
import type { UserPreferences } from "@/lib/ranking";

const fixture = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "fixtures", "sheets-api-2271.json"),
    "utf8",
  ),
) as SheetsApiResponse;

const basePrefs: UserPreferences = {
  termCode: "2271",
  earliestTime: "08:00",
  latestTime: "21:00",
  preferDays: [],
  avoidDays: [],
  modes: [],
  maxCredits: 20,
  weightQuality: 50,
  weightEasiness: 25,
  weightWouldTakeAgain: 25,
};

describe("effectiveInstructor + inferred", () => {
  it("uses ctcLink instructor and never invents overrides", () => {
    expect(
      effectiveInstructor({
        instructor: "Nguyen, Mai",
        instructor_override: "",
      }),
    ).toBe("Nguyen, Mai");
  });

  it("keeps Staff when only inferred is present", () => {
    const staff = fixture.sections.find(
      (s) => s.course_code === "ENGL 128" && s.staff_tba,
    );
    expect(staff).toBeTruthy();
    expect(effectiveInstructor(staff!)).toBe("Staff");
    expect(inferredInstructorName(staff!).length).toBeGreaterThan(0);
    expect(hasConfirmedRmp(staff!)).toBe(false);
  });

  it("marks confirmed RMP on named instructors", () => {
    const named = fixture.sections.find(
      (s) => s.course_code === "ENGL 128" && !s.staff_tba,
    );
    expect(named).toBeTruthy();
    expect(hasConfirmedRmp(named!)).toBe(true);
  });
});

describe("expandDays new sheet codes", () => {
  it("parses MoWe / TuTh / multi-meeting", () => {
    expect(expandDays("MoWe")).toEqual(["M", "W"]);
    expect(expandDays("TuTh")).toEqual(["T", "Th"]);
    expect(expandDays("MoWeFr")).toEqual(["M", "W", "F"]);
    expect(expandDays("TuFr; Mo")).toEqual(["T", "F", "M"]);
    expect(expandDays("ARR")).toEqual([]);
  });

  it("still parses legacy MW / TTh", () => {
    expect(expandDays("MW")).toEqual(["M", "W"]);
    expect(expandDays("TTh")).toEqual(["T", "Th"]);
  });
});

describe("conflicts", () => {
  it("detects overlapping same-day sections", () => {
    expect(
      sectionsConflict(
        {
          days: "MoWe",
          start_time: "10:00 AM",
          end_time: "12:00 PM",
        },
        {
          days: "MoWeFr",
          start_time: "11:00 AM",
          end_time: "12:00 PM",
        },
      ),
    ).toBe(true);
  });

  it("allows different days", () => {
    expect(
      sectionsConflict(
        { days: "MoWe", start_time: "10:00 AM", end_time: "12:00 PM" },
        { days: "TuTh", start_time: "10:00 AM", end_time: "12:00 PM" },
      ),
    ).toBe(false);
  });
});

describe("recommendCourses + schedule fallback", () => {
  it("returns up to 3 ranked options with reasons", () => {
    const recs = recommendCourses(
      ["ENGL 128", "POLS& 202", "CHEM& 161", "ENGR 100"],
      fixture,
      basePrefs,
    );
    expect(recs).toHaveLength(4);
    const engl = recs.find((r) => r.courseCode === "ENGL 128");
    expect(engl?.options.length).toBeGreaterThanOrEqual(2);
    expect(engl?.options[0].rankLabel).toBe("1st option");
    expect(engl?.options[0].reason.length).toBeGreaterThan(0);
    // Confirmed named instructors should appear; Staff stays Staff
    const named = engl?.options.find((o) => o.professorName !== "Staff");
    expect(named).toBeTruthy();
    const staffOpt = engl?.options.find((o) => o.flags.staff);
    if (staffOpt) {
      expect(staffOpt.professorName).toBe("Staff");
      expect(staffOpt.flags.inferred).toBe(true);
    }
  });

  it("prefers confirmed RMP instructor over Staff", () => {
    const recs = recommendCourses(["ENGR 100"], fixture, {
      ...basePrefs,
      weightQuality: 80,
      weightEasiness: 10,
      weightWouldTakeAgain: 10,
    });
    expect(recs[0].options[0].flags.staff).toBe(false);
    expect(recs[0].options[0].professorName).not.toBe("Staff");
    expect(hasConfirmedRmp(recs[0].options[0].section)).toBe(true);
  });

  it("ranks Staff/inferred below confirmed even with strong inferred RMP", () => {
    const recs = recommendCourses(["ENGL 128"], fixture, {
      ...basePrefs,
      weightQuality: 90,
      weightEasiness: 5,
      weightWouldTakeAgain: 5,
    });
    const top = recs[0].options[0];
    expect(top.flags.staff).toBe(false);
    expect(top.flags.inferred).toBe(false);
  });

  it("falls back to 2nd/3rd when 1st conflicts in schedule builder", () => {
    const recs = recommendCourses(
      ["ENGL 128", "ENGR 100"],
      fixture,
      basePrefs,
    );
    const engl = recs.find((r) => r.courseCode === "ENGL 128");
    const engr = recs.find((r) => r.courseCode === "ENGR 100");
    expect(engl?.options[0]).toBeTruthy();
    expect(engr?.options[0]).toBeTruthy();
    expect(engr!.options.length).toBeGreaterThanOrEqual(2);
    engl!.options[0].section = {
      ...engl!.options[0].section,
      days: "MoWe",
      start_time: "10:00 AM",
      end_time: "12:00 PM",
    };
    engr!.options[0].section = {
      ...engr!.options[0].section,
      days: "MoWe",
      start_time: "10:00 AM",
      end_time: "12:00 PM",
    };
    engr!.options[1].section = {
      ...engr!.options[1].section,
      days: "Fr",
      start_time: "1:00 PM",
      end_time: "3:00 PM",
    };
    const schedule = buildSchedule(recs, basePrefs);
    expect(schedule.blocks.length).toBe(2);
    const engrBlock = schedule.blocks.find((b) => b.courseCode === "ENGR 100");
    expect(engrBlock?.fallbackRank).toBeGreaterThan(1);
    expect(schedule.usedFallbacks.length).toBeGreaterThan(0);
  });
});
