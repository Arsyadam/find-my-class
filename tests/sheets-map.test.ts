import { describe, expect, it } from "vitest";
import { mapSheetRow, parseCsv, parseTimes, primaryInferred } from "@/lib/sheets/mapRow";

describe("parseTimes / inferred", () => {
  it("splits first meeting from multi-range Times", () => {
    expect(parseTimes("8:00 AM-9:25 AM; 8:00 AM-9:50 AM")).toEqual({
      start_time: "8:00 AM",
      end_time: "9:25 AM",
      times_raw: "8:00 AM-9:25 AM; 8:00 AM-9:50 AM",
    });
  });

  it("strips inferred annotation", () => {
    expect(
      primaryInferred(
        "Ann Modzelewski (inferred, not confirmed); Walter Lowe (inferred, not confirmed)",
      ),
    ).toBe("Ann Modzelewski");
  });
});

describe("parseCsv + mapSheetRow", () => {
  it("maps quoted headers with commas", () => {
    const csv = [
      'Term,Term code,Course,Title,Section,Class #,Days,Times,Instructor(s) (ctcLink),Staff/TBA?,"Likely instructor (inferred, NOT confirmed)",RMP overall,RMP match,Match confidence,ctcLink class details link',
      'Winter 2027,2271,ENGL 128,Research Writing,A,10000,MoWe,10:00 AM-11:50 AM,Staff,Yes,"Ann Modzelewski (inferred, not confirmed)",,,no match (Staff/TBA),https://example/class',
      "Winter 2027,2271,ENGL 128,Research Writing,DEK,10010,ARR,,Patrick Milian,No,,4.8,Patrick Milian,exact,https://example/class2",
    ].join("\n");

    const rows = parseCsv(csv);
    expect(rows).toHaveLength(2);
    const staff = mapSheetRow(rows[0], { termFallback: "2271" })!;
    expect(staff.course_code).toBe("ENGL 128");
    expect(staff.staff_tba).toBe(true);
    expect(staff.inferred_instructor).toBe("Ann Modzelewski");
    expect(staff.rmp_confirmed).toBe(false);
    expect(staff.start_time).toBe("10:00 AM");

    const named = mapSheetRow(rows[1], { termFallback: "2271" })!;
    expect(named.instructor).toBe("Patrick Milian");
    expect(named.rmp_confirmed).toBe(true);
    expect(named.rmp_overall).toBe(4.8);
  });
});
