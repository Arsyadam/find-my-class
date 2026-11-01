import { NextResponse } from "next/server";
import { fetchSheetsData } from "@/lib/sheets";

export const runtime = "nodejs";

/** Unique course codes offered for a term (for typed-course autocomplete). */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const termCode =
      searchParams.get("term") ||
      searchParams.get("termCode") ||
      process.env.DEFAULT_TERM_CODE ||
      "2271";

    const data = await fetchSheetsData({ termCode, courseCodes: [] });
    const codes = [
      ...new Set(
        (data.sections ?? [])
          .filter(
            (s) =>
              String(s.term_code) === String(termCode) &&
              !(s.removed === true || String(s.removed).toUpperCase() === "TRUE"),
          )
          .map((s) => s.course_code.trim().replace(/\s+/g, " "))
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

    return NextResponse.json({
      ok: true,
      termCode,
      source: data.source ?? "live",
      courses: codes,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list courses" },
      { status: 500 },
    );
  }
}
