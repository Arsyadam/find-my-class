const PDF_MAGIC = new TextEncoder().encode("%PDF");

export class PdfValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfValidationError";
  }
}

export function isPdfMagic(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  return (
    bytes[0] === PDF_MAGIC[0] &&
    bytes[1] === PDF_MAGIC[1] &&
    bytes[2] === PDF_MAGIC[2] &&
    bytes[3] === PDF_MAGIC[3]
  );
}

/**
 * Accept Educational Plan PDFs only. Rejects images / screenshots by MIME and magic bytes.
 */
export function validateEdplanPdf(
  bytes: Uint8Array,
  mimeType?: string | null,
): void {
  const mime = (mimeType ?? "").toLowerCase().trim();

  if (
    mime.startsWith("image/") ||
    mime === "image/png" ||
    mime === "image/jpeg" ||
    mime === "image/jpg" ||
    mime === "image/webp" ||
    mime === "image/gif"
  ) {
    throw new PdfValidationError(
      "Screenshots and image files are not supported. Upload your Educational Plan as a PDF.",
    );
  }

  if (mime && mime !== "application/pdf" && mime !== "application/x-pdf") {
    throw new PdfValidationError(
      `Unsupported file type "${mime}". Please upload a PDF Educational Plan.`,
    );
  }

  if (!isPdfMagic(bytes)) {
    throw new PdfValidationError(
      "File does not look like a PDF (missing %PDF header). Export or download the Educational Plan as PDF and try again.",
    );
  }
}
