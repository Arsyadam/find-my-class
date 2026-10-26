import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { effectiveInstructor } from "@/lib/sheets/types";
import {
  buildSchedule,
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

describe("effectiveInstructor override precedence", () => {
  it("uses override over ctclink", () => {
    expect(
      effectiveInstructor({
        instructor_ctclink: "Staff",
        instructor_override: "Chen, Li",
        effective_instructor: "Staff",
      }),
    ).toBe("Chen, Li");
  });

  it("falls back to ctclink when override empty", () => {
    expect(
      effectiveInstructor({
        instructor_ctclink: "Nguyen, Mai",
        instructor_override: "",
      }),
    ).toBe("Nguyen, Mai");
  });
});

describe("conflicts", () => {
  it("detects overlapping same-day sections", () => {
    expect(
      sectionsConflict(
        {
          days: "MW",
          start_time: "10:00 AM",
          end_time: "12:00 PM",
        },
        {
          days: "MWF",
          start_time: "11:00 AM",
          end_time: "12:00 PM",
        },
      ),
    ).toBe(true);
  });

  it("allows different days", () => {
    expect(
      sectionsConflict(
        { days: "MW", start_time: "10:00 AM", end_time: "12:00 PM" },
        { days: "TTh", start_time: "10:00 AM", end_time: "12:00 PM" },
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
    // Override section should surface Chen, Li not Staff
    const chen = engl?.options.find((o) => o.professorName === "Chen, Li");
    expect(chen).toBeTruthy();
  });

  it("prefers named instructor over Staff when quality weights equal", () => {
    const recs = recommendCourses(["ENGR 100"], fixture, {
      ...basePrefs,
      weightQuality: 80,
      weightEasiness: 10,
      weightWouldTakeAgain: 10,
    });
    expect(recs[0].options[0].professorName).toBe("Hassan, Amira");
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
    // Pin ENGL 1st to a timed MW block, then make ENGR 1st collide with it.
    engl!.options[0].section = {
      ...engl!.options[0].section,
      days: "MW",
      start_time: "10:00 AM",
      end_time: "12:00 PM",
    };
    engr!.options[0].section = {
      ...engr!.options[0].section,
      days: "MW",
      start_time: "10:00 AM",
      end_time: "12:00 PM",
    };
    // Ensure a non-conflicting 2nd option remains for ENGR
    engr!.options[1].section = {
      ...engr!.options[1].section,
      days: "F",
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
