import type { SheetsApiResponse } from "./types";

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  return t.startsWith("{") || t.startsWith("[");
}

async function fetchAppsScriptApi(options: {
  apiUrl: string;
  termCode: string;
  courseCodes: string[];
  token: string;
  revalidate: number;
}): Promise<SheetsApiResponse> {
  const url = new URL(options.apiUrl);
  url.searchParams.set("term", options.termCode);
  if (options.courseCodes.length) {
    url.searchParams.set("courses", options.courseCodes.join(","));
  }
  if (options.token) url.searchParams.set("token", options.token);

  const res = await fetch(url.toString(), {
    redirect: "follow",
    next: { revalidate: options.revalidate },
    headers: { Accept: "application/json,text/plain,*/*" },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Sheets API HTTP ${res.status}: ${text.slice(0, 180).replace(/\s+/g, " ")}`,
    );
  }
  if (!looksLikeJson(text)) {
    throw new Error(
      "Sheets API returned non-JSON (often an Apps Script login/HTML page). " +
        "Redeploy the web app as Anyone, or unset SHEETS_API_URL to use the public sheet CSV.",
    );
  }

  const data = JSON.parse(text) as SheetsApiResponse & { error?: string };
  if (data.error === "unauthorized") {
    throw new Error(
      "Sheets API unauthorized — SHEETS_API_TOKEN does not match script property",
    );
  }
  if (data.error && !data.sections?.length) {
    throw new Error(`Sheets API error: ${data.error}`);
  }
  return { ...data, source: data.source ?? "live" };
}

/**
 * Load term sections for ranking.
 *
 * Order:
 * 1. SHEETS_API_URL (Apps Script) when set
 * 2. On Apps Script failure → public Google Sheet CSV (new SoT)
 * 3. When no SHEETS_API_URL → public CSV, then fixtures if CSV fails
 */
export async function fetchSheetsData(options: {
  termCode: string;
  courseCodes: string[];
  apiUrl?: string;
  token?: string;
  revalidateSeconds?: number;
}): Promise<SheetsApiResponse> {
  const apiUrl = options.apiUrl ?? process.env.SHEETS_API_URL ?? "";
  const token = options.token ?? process.env.SHEETS_API_TOKEN ?? "";
  const revalidate =
    options.revalidateSeconds ??
    Number(process.env.REVALIDATE_SECONDS ?? 600);
  const rev = Number.isFinite(revalidate) ? revalidate : 600;

  const loadCsv = async () => {
    const { fetchGoogleSheetCsv } = await import("./googleCsv");
    return fetchGoogleSheetCsv({
      termCode: options.termCode,
      courseCodes: options.courseCodes,
      revalidateSeconds: rev,
    });
  };

  if (apiUrl) {
    try {
      return await fetchAppsScriptApi({
        apiUrl,
        termCode: options.termCode,
        courseCodes: options.courseCodes,
        token,
        revalidate: rev,
      });
    } catch (err) {
      console.warn(
        "[sheets] Apps Script failed, falling back to Google Sheet CSV:",
        err instanceof Error ? err.message : err,
      );
      try {
        return await loadCsv();
      } catch (csvErr) {
        throw new Error(
          `Sheets API and CSV fallback both failed. API: ${
            err instanceof Error ? err.message : String(err)
          }; CSV: ${
            csvErr instanceof Error ? csvErr.message : String(csvErr)
          }`,
        );
      }
    }
  }

  try {
    return await loadCsv();
  } catch (csvErr) {
    console.warn(
      "[sheets] Google Sheet CSV failed, using fixtures:",
      csvErr instanceof Error ? csvErr.message : csvErr,
    );
    const { loadFixtureApi } = await import("./fixture");
    return loadFixtureApi(options.termCode, options.courseCodes);
  }
}
