import { NextResponse } from "next/server";
import { parseEdplanPdf, PdfValidationError, validateEdplanPdf } from "@/lib/edplan";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing PDF file" }, { status: 400 });
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    validateEdplanPdf(buffer, file.type || "application/pdf");
    const parsed = await parseEdplanPdf(buffer);

    return NextResponse.json({
      ok: true,
      source: parsed.source,
      warnings: parsed.warnings,
      terms: parsed.terms,
    });
  } catch (err) {
    if (err instanceof PdfValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Parse failed" },
      { status: 500 },
    );
  }
}
