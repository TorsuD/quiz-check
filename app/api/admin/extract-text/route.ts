import { isAdmin, unauthorizedResponse } from "@/lib/admin";
import { extractFileText, MAX_UPLOAD_BYTES, UnsupportedFileError } from "@/lib/extract";

function fail(error: string, status = 400) {
  return Response.json({ error }, { status });
}

/**
 * Reads the text out of an uploaded lecture file (PDF, Word, PowerPoint, etc.) and returns it, without saving anything.
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
  if (!(file instanceof File) || file.size === 0) return fail("No file was uploaded.");
  if (file.size > MAX_UPLOAD_BYTES) return fail("File is larger than 10 MB.");
  try {
    const text = await extractFileText(file);
    return Response.json({ text }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof UnsupportedFileError) return fail(err.message);
    console.error("File extraction failed", err);
    return fail("Could not read text from that file. If it is a scanned image, paste the text instead.");
  }
}
