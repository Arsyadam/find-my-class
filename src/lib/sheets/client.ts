import type { SheetsApiResponse } from "./types";

export async function fetchSheetsData(options: {
  termCode: string;
  courseCodes: string[];
  apiUrl?: string;
  token?: string;
  revalidateSeconds?: number;
}): Promise<SheetsApiResponse> {
  const apiUrl = options.apiUrl ?? process.env.SHEETS_API_URL ?? "";
  const token = options.token ?? process.env.SHEETS_API_TOKEN ?? "";
  const revalidate = options.revalidateSeconds ??
    Number(process.env.REVALIDATE_SECONDS ?? 600);

  if (!apiUrl) {
    const { loadFixtureApi } = await import("./fixture");
    return loadFixtureApi(options.termCode, options.courseCodes);
  }

  const url = new URL(apiUrl);
  url.searchParams.set("term", options.termCode);
  if (options.courseCodes.length) {
    url.searchParams.set("courses", options.courseCodes.join(","));
  }
  if (token) url.searchParams.set("token", token);

  const res = await fetch(url.toString(), {
    next: { revalidate: Number.isFinite(revalidate) ? revalidate : 600 },
  });

  if (!res.ok) {
    throw new Error(`Sheets API HTTP ${res.status}`);
  }

  const data = (await res.json()) as SheetsApiResponse;
  return { ...data, source: data.source ?? "live" };
}
