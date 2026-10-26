import { NextResponse } from "next/server";
import { buildSchedule, recommendCourses, type UserPreferences } from "@/lib/ranking";
import { fetchSheetsData } from "@/lib/sheets";

export const runtime = "nodejs";

interface RecommendBody {
  termCode: string;
  courseCodes: string[];
  preferences: Partial<UserPreferences>;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RecommendBody;
    const termCode = body.termCode || process.env.DEFAULT_TERM_CODE || "2271";
    const courseCodes = (body.courseCodes || []).filter(Boolean);

    if (!courseCodes.length) {
      return NextResponse.json(
        { error: "Provide at least one course code" },
        { status: 400 },
      );
    }

    const prefs: UserPreferences = {
      termCode,
      earliestTime: body.preferences?.earliestTime ?? "08:00",
      latestTime: body.preferences?.latestTime ?? "21:00",
      preferDays: body.preferences?.preferDays ?? [],
      avoidDays: body.preferences?.avoidDays ?? [],
      modes: body.preferences?.modes ?? [],
      maxCredits: body.preferences?.maxCredits ?? 18,
      weightQuality: body.preferences?.weightQuality ?? 50,
      weightEasiness: body.preferences?.weightEasiness ?? 25,
      weightWouldTakeAgain: body.preferences?.weightWouldTakeAgain ?? 25,
    };

    const data = await fetchSheetsData({ termCode, courseCodes });
    const recommendations = recommendCourses(courseCodes, data, prefs);
    const schedule = buildSchedule(recommendations, prefs);

    return NextResponse.json({
      ok: true,
      source: data.source ?? "live",
      recommendations,
      schedule,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Recommend failed" },
      { status: 500 },
    );
  }
}
