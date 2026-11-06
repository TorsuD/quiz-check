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

  if (mode === "import") {
    // Same fence stripping and zod validation as LLM output, but no retry: the error goes back to the admin.
    const parsed = parseGeneration(importJson);
    if (!parsed.ok) return fail(`Could not import: ${parsed.problem}`);
    const output: GenerationOutput = { questions: parsed.questions, provider: "import", model: importModel, attempts: 0 };
    return Response.json(await save(output, { title, sourceType, fileName, text }));
  }

  // LLM mode streams newline-delimited JSON events so the page can show a live progress bar:
  //   {type:"progress", started, total, attempt}  then  {type:"saving"}  then  {type:"done", ...} or {type:"error", error}
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: GenerateEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        send({ type: "progress", started: 0, total: count, attempt: 1 });
        const output = await generateQuestions(title, text, count, (p) => send({ type: "progress", total: count, ...p }));
        send({ type: "saving" });
        send({ type: "done", ...(await save(output, { title, sourceType, fileName, text })) });
      } catch (err) {
        console.error("Generation failed", err);
        const message = err instanceof Error ? err.message : "Unknown error";
        send({ type: "error", error: err instanceof GenerationError ? message : `The LLM request failed: ${message}` });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}

export type GenerateEvent =
  | { type: "progress"; started: number; total: number; attempt: number }
  | { type: "saving" }
  | { type: "done"; lectureId: string; count: number; attempts: number; model: string }
  | { type: "error"; error: string };

async function save(
  output: GenerationOutput,
  source: { title: string; sourceType: "pdf" | "text"; fileName: string | null; text: string },
) {
  await connectDB();
  const generatedAt = new Date();
  const lecture = await Lecture.create(source);
  await Question.insertMany(
    output.questions.map((q, i) => ({
      lectureId: lecture._id,
      order: i + 1,
      ...q,
      excerptFoundInText: excerptAppearsIn(q.sourceExcerpt, source.text),
      model: output.model,
      provider: output.provider,
      generatedAt,
    })),
  );
  return { lectureId: String(lecture._id), count: output.questions.length, attempts: output.attempts, model: output.model };
}
