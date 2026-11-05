import { isAdmin, unauthorizedResponse } from "@/lib/admin";
import { connectDB } from "@/lib/db";
import { GenerationError, excerptAppearsIn, generateQuestions, parseGeneration, type GenerationOutput } from "@/lib/generate";
import { Lecture, Question } from "@/lib/models";
import { extractPdfText } from "@/lib/pdf";

// Generation with a large model can take a minute or more.
export const maxDuration = 300;

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_CHARS = 400_000;
const MIN_TEXT_CHARS = 200;

function fail(error: string, status = 400) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return unauthorizedResponse();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Could not read the upload. If the PDF is large, try pasting the text instead.");
  }

  // mode "llm" (default) calls the configured LLM; mode "import" takes questions JSON produced elsewhere.
  const mode = form.get("mode") === "import" ? "import" : "llm";
  const title = String(form.get("title") ?? "").trim();
  const count = Number(form.get("count") ?? 10);
  const pasted = String(form.get("text") ?? "").trim();
  const file = form.get("file");
  const importJson = String(form.get("json") ?? "").trim();
  const importModel = String(form.get("model") ?? "").trim().slice(0, 100) || "manual-import";

  if (!title) return fail("Please give the lecture a title.");
  if (mode === "llm" && (!Number.isInteger(count) || count < 1 || count > 30)) {
    return fail("Number of questions must be between 1 and 30.");
  }
  if (mode === "import" && !importJson) return fail("Paste or upload the questions JSON.");

  let text = pasted;
  let sourceType: "pdf" | "text" = "text";
  let fileName: string | null = null;

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_PDF_BYTES) return fail("PDF is larger than 10 MB.");
    if (file.type && file.type !== "application/pdf") return fail("Only PDF files are supported.");
    try {
      text = await extractPdfText(new Uint8Array(await file.arrayBuffer()));
    } catch (err) {
      console.error("PDF extraction failed", err);
      return fail("Could not read text from that PDF. If it is a scanned image, paste the text instead.");
    }
    sourceType = "pdf";
    fileName = file.name;
  }

  if (text.length < MIN_TEXT_CHARS) {
    return fail(
      sourceType === "pdf"
        ? "Very little text was found in the PDF (is it scanned?). Paste the text instead."
        : "Please paste the lecture notes (at least a few paragraphs).",
    );
  }
  if (text.length > MAX_TEXT_CHARS) {
    return fail(`The notes are too long (${text.length.toLocaleString()} characters; limit ${MAX_TEXT_CHARS.toLocaleString()}). Split the lecture into parts.`);
  }

  let output: GenerationOutput;
  if (mode === "import") {
    // Same fence stripping and zod validation as LLM output, but no retry: the error goes back to the admin.
    const parsed = parseGeneration(importJson);
    if (!parsed.ok) return fail(`Could not import: ${parsed.problem}`);
    output = { questions: parsed.questions, provider: "import", model: importModel, attempts: 0 };
  } else {
    try {
      output = await generateQuestions(title, text, count);
    } catch (err) {
      console.error("Generation failed", err);
      if (err instanceof GenerationError) return fail(err.message, 502);
      const message = err instanceof Error ? err.message : "Unknown error";
      return fail(`The LLM request failed: ${message}`, 502);
    }
  }

  await connectDB();
  const generatedAt = new Date();
  const lecture = await Lecture.create({ title, sourceType, fileName, text });
  await Question.insertMany(
    output.questions.map((q, i) => ({
      lectureId: lecture._id,
      order: i + 1,
      ...q,
      excerptFoundInText: excerptAppearsIn(q.sourceExcerpt, text),
      model: output.model,
      provider: output.provider,
      generatedAt,
    })),
  );

  return Response.json({
    lectureId: String(lecture._id),
    count: output.questions.length,
    attempts: output.attempts,
    model: output.model,
  });
}
