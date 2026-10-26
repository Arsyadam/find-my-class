/**
 * Generate a synthetic Publisher-style Edplan PDF with AcroForm fields.
 * No real student PII — for tests and demos only.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

async function main() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([792, 612]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText("Synthetic GRC Educational Plan (fixture — not a real student)", {
    x: 40,
    y: 560,
    size: 14,
    font,
    color: rgb(0.1, 0.35, 0.2),
  });
  page.drawText("Winter 2027 = column _3 · Spring 2027 = column _4", {
    x: 40,
    y: 540,
    size: 10,
    font,
  });

  const form = pdf.getForm();

  const winter: Array<[number, string, string]> = [
    [1, "ENGL 128", "5"],
    [2, "POLS& 202 (ss)", "5"],
    [3, "CHEM& 161", "6"],
    [4, "ENGR 100", "2"],
  ];
  const spring: Array<[number, string, string]> = [
    [1, "MATH& 152", "5"],
    [2, "CHEM& 162", "6"],
    [3, "PHYS& 221", "5"],
    [4, "ENGR 106", "3"],
  ];
  // Extra column with a placeholder for needsChoice tests
  const fallish: Array<[number, string, string]> = [
    [1, "ENGL&/101", "5"],
    [3, "Humanities/Social Science", "5"],
  ];

  function addField(name: string, value: string, x: number, y: number) {
    const field = form.createTextField(name);
    field.setText(value);
    field.addToPage(page, { x, y, width: 140, height: 16 });
  }

  winter.forEach(([row, title, credits], i) => {
    addField(`Class Title ie ENGL 101Row${row}_3`, title, 40, 480 - i * 40);
    addField(`CreditsRow${row}_3`, credits, 200, 480 - i * 40);
  });
  spring.forEach(([row, title, credits], i) => {
    addField(`Class Title ie ENGL 101Row${row}_4`, title, 360, 480 - i * 40);
    addField(`CreditsRow${row}_4`, credits, 520, 480 - i * 40);
  });
  fallish.forEach(([row, title, credits], i) => {
    addField(`Class Title ie ENGL 101Row${row}_2`, title, 40, 280 - i * 40);
    addField(`CreditsRow${row}_2`, credits, 200, 280 - i * 40);
  });

  // Non-PII placeholder identity fields (synthetic)
  addField("STUDENT NAME", "Synthetic Student", 40, 80);
  addField("STUDENT ID NUMBER", "000000000", 240, 80);
  addField("INTENDED MAJOR", "Demo Major", 440, 80);

  const outDir = path.join(process.cwd(), "fixtures");
  mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, "synthetic-edplan.pdf");
  writeFileSync(out, await pdf.save());
  console.log("Wrote", out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
