import "server-only";
import { PDFParse } from "pdf-parse";

export async function extractPdfText(data: Uint8Array): Promise<string> {
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return result.text
      .replace(/\r\n/g, "\n")
      .replace(/-- \d+ of \d+ --/g, "") // page separators pdf-parse inserts
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } finally {
    await parser.destroy();
  }
}
