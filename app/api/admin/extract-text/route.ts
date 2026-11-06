import { isAdmin, unauthorizedResponse } from "@/lib/admin";
import { extractPdfText } from "@/lib/pdf";

const MAX_PDF_BYTES = 10 * 1024 * 1024;

function fail(error: string, status = 400) {
  return Response.json({ error }, { status });
}

/**
 * Reads the text out of an uploaded PDF and returns it, without saving anything.
 * The generate form uses it to preview the notes and to build the copyable prompt in PDF mode.
 * It uses the same extractor as /api/admin/generate, so the preview matches what gets stored.
 */
export async function POST(request: Request) {
  if (!(await isAdmin())) return unauthorizedResponse();
  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return fail("Could not read the upload.");
  }
  if (!(file instanceof File) || file.size === 0) return fail("No PDF was uploaded.");
  if (file.size > MAX_PDF_BYTES) return fail("PDF is larger than 10 MB.");
  if (file.type && file.type !== "application/pdf") return fail("Only PDF files are supported.");
  try {
    const text = await extractPdfText(new Uint8Array(await file.arrayBuffer()));
    return Response.json({ text }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("PDF extraction failed", err);
    return fail("Could not read text from that PDF. If it is a scanned image, paste the text instead.");
  }
}
