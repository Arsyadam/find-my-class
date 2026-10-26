import { describe, expect, it } from "vitest";
import {
  isPdfMagic,
  PdfValidationError,
  validateEdplanPdf,
} from "@/lib/edplan/validate";

describe("validateEdplanPdf", () => {
  it("accepts PDF magic + application/pdf", () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
    expect(() => validateEdplanPdf(bytes, "application/pdf")).not.toThrow();
    expect(isPdfMagic(bytes)).toBe(true);
  });

  it("rejects PNG by MIME even with fake bytes", () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    expect(() => validateEdplanPdf(bytes, "image/png")).toThrow(
      PdfValidationError,
    );
  });

  it("rejects JPEG MIME", () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff]);
    expect(() => validateEdplanPdf(bytes, "image/jpeg")).toThrow(
      /Screenshots and image/,
    );
  });

  it("rejects missing %PDF magic", () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    expect(() => validateEdplanPdf(bytes, "application/pdf")).toThrow(
      /missing %PDF/,
    );
  });
});
