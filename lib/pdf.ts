import "server-only";

/*
 * pdf-parse bundles pdf.js, which needs the browser globals DOMMatrix, Path2D and ImageData the
 * moment it loads. Node has none of them. Locally pdf.js quietly polyfills them from @napi-rs/canvas,
 * but on serverless hosts (Vercel) that failed and uploads crashed with
 * "ReferenceError: DOMMatrix is not defined". So the pieces load strictly one after another:
 *   1. @napi-rs/canvas, and install the globals from it
 *   2. pdf-parse's worker helper
 *   3. pdf-parse itself
 * Turbopack loads external packages in parallel, so ordinary top-level imports could not
 * guarantee this order; sequential dynamic imports can.
 */
type PdfLib = {
  PDFParse: typeof import("pdf-parse").PDFParse;
  CanvasFactory: typeof import("pdf-parse/worker").CanvasFactory;
};

let loading: Promise<PdfLib> | null = null;

function loadPdfLib(): Promise<PdfLib> {
  loading ??= (async () => {
    const canvas = await import("@napi-rs/canvas");
    const g = globalThis as Record<string, unknown>;
    g.DOMMatrix ??= canvas.DOMMatrix;
    g.Path2D ??= canvas.Path2D;
    g.ImageData ??= canvas.ImageData;

    const { CanvasFactory, getData } = await import("pdf-parse/worker");
    const { PDFParse } = await import("pdf-parse");
    // Load pdf.js's worker from an inline data URL, so no separate worker file has to be deployed.
    PDFParse.setWorker(getData());
    return { PDFParse, CanvasFactory };
  })().catch((err) => {
    loading = null; // allow a retry on the next upload
    throw err;
  });
  return loading;
}

export async function extractPdfText(data: Uint8Array): Promise<string> {
  const { PDFParse, CanvasFactory } = await loadPdfLib();
  const parser = new PDFParse({ data, CanvasFactory });
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
