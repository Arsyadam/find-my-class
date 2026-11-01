import { NextResponse } from "next/server";
import { fetchSheetsData } from "@/lib/sheets";

export const runtime = "nodejs";

/** Unique course codes for a term (optionally filtered by query prefix). */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const termCode =
      searchParams.get("term") ||
      process.env.DEFAULT_TERM_CODE ||
      "2271";
    const q = (searchParams.get("q") || "").trim().toUpperCase();

    const data = await fetchSheetsData({ termCode, courseCodes: [] });
    const codes = Array.from(
      new Set(
        data.sections
          .filter(
            (s) =>
              String(s.term_code) === String(termCode) &&
              !(s.removed === true || String(s.removed).toUpperCase() === "TRUE"),
          )
          .map((s) => s.course_code.toUpperCase().replace(/\s+/g, " ")),
      ),
    ).sort();

    const filtered = q
      ? codes.filter((c) => c.includes(q.replace(/\s+/g, " ")))
      : codes;

    return NextResponse.json({
      ok: true,
      termCode,
      source: data.source ?? "live",
      courses: filtered.slice(0, 40),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Catalog failed" },
      { status: 500 },
    );
  }
}
