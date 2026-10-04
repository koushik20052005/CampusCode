import { PDFParse } from "pdf-parse";

/**
 * Extract text from a PDF buffer using pdf-parse v2.
 *
 * @param {Buffer} pdfBuffer
 * @returns {Promise<string>}
 */
export async function extractPdfText(pdfBuffer) {
  if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
    throw new Error("Invalid PDF buffer");
  }

  const parser = new PDFParse({
    data: pdfBuffer,
  });

  try {
    const result = await parser.getText();

    return String(result?.text || "").trim();
  } finally {
    await parser.destroy();
  }
}