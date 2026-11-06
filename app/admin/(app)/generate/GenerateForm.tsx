"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { GenerateEvent } from "@/app/api/admin/generate/route";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/prompts";
import { parseJsonLoose } from "@/lib/text";

type Source = "llm" | "import";
type NotesMode = "pdf" | "text";

/** Live state of an LLM generation, built from the events the generate route streams back. */
type Progress = {
  startedAt: number;
  phase: "reading" | "writing" | "saving";
  started: number; // questions the model has begun writing
  total: number;
  attempt: number;
  firstQuestionAt: number | null; // when the model started writing question 1 (of the current attempt)
};

const JSON_EXAMPLE = `{
  "questions": [
    {
      "question": "…",
      "options": ["…", "…", "…", "…"],
      "correctIndex": 0,
      "explanation": "…",
      "sourceExcerpt": "exact passage from the notes",
      "difficulty": "easy"
    }
  ]
}`;

export default function GenerateForm() {
  const router = useRouter();
  const [source, setSource] = useState<Source>("llm");
  const [notesMode, setNotesMode] = useState<NotesMode>("pdf");
  const [title, setTitle] = useState("");
  const [count, setCount] = useState(10);
  const [file, setFile] = useState<File | null>(null);
  // Text read out of the chosen PDF, so it can be previewed and put into the copied prompt.
  const [pdf, setPdf] = useState<{ status: "idle" | "reading" | "ok" | "error"; text: string; error?: string; name?: string }>({
    status: "idle",
    text: "",
  });
  const [text, setText] = useState("");
  const [json, setJson] = useState("");
  const [model, setModel] = useState("");
  const [copied, setCopied] = useState(false);
  const [formatMsg, setFormatMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);

  const hasNotes = notesMode === "pdf" ? Boolean(file) : text.trim().length > 0;
  const ready =
    title.trim() &&
    hasNotes &&
    (source === "llm" ? count >= 1 && count <= 30 : json.trim().length > 0);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("mode", source);
    form.set("title", title.trim());
    form.set("count", String(count));
    if (notesMode === "pdf" && file) form.set("file", file);
    else form.set("text", text);
    if (source === "import") {
      form.set("json", json);
      form.set("model", model.trim());
    }

    if (source === "llm") setProgress({ startedAt: Date.now(), phase: "reading", started: 0, total: count, attempt: 1, firstQuestionAt: null });
    try {
      const res = await fetch("/api/admin/generate", { method: "POST", body: form });
      const isStream = res.ok && res.headers.get("content-type")?.includes("ndjson") && res.body;
      if (!isStream) {
        // Import mode, and any validation error, come back as a single JSON body.
        const data = await res.json().catch(() => ({ error: `Server error (${res.status}). The request may have timed out.` }));
        if (!res.ok) throw new Error(data.error ?? "Request failed.");
        router.push(`/admin/lectures/${data.lectureId}`);
        return;
      }
      const lectureId = await readEvents(res.body!, (event) =>
        setProgress((p) => {
          if (!p) return p;
          if (event.type === "saving") return { ...p, phase: "saving" };
          if (event.type !== "progress") return p;
          const newAttempt = event.attempt !== p.attempt;
          const firstQuestionAt = newAttempt ? null : p.firstQuestionAt;
          return {
            ...p,
            phase: event.started > 0 ? "writing" : "reading",
            started: event.started,
            total: event.total,
            attempt: event.attempt,
            firstQuestionAt: firstQuestionAt ?? (event.started > 0 ? Date.now() : null),
          };
        }),
      );
      router.push(`/admin/lectures/${lectureId}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
      setProgress(null);
    }
  }

  const notesText = notesMode === "pdf" ? pdf.text : text.trim();

  async function choosePdf(f: File | null) {
    setFile(f);
    if (!f) return setPdf({ status: "idle", text: "" });
    setPdf({ status: "reading", text: "", name: f.name });
    const form = new FormData();
    form.set("file", f);
    try {
      const res = await fetch("/api/admin/extract-text", { method: "POST", body: form });
      const data = await res.json().catch(() => ({ error: `Server error (${res.status}).` }));
      if (!res.ok) throw new Error(data.error ?? "Could not read the PDF.");
      // Ignore the result if another file was chosen meanwhile.
      setPdf((cur) => (cur.name === f.name ? { status: "ok", text: data.text as string, name: f.name } : cur));
    } catch (err) {
      setPdf((cur) => (cur.name === f.name ? { status: "error", text: "", error: (err as Error).message, name: f.name } : cur));
    }
  }

  async function copyPrompt() {
    const prompt = `${SYSTEM_PROMPT}\n\n${buildUserPrompt(title.trim() || "Untitled lecture", notesText, count)}`;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  /** Pretty-prints the pasted JSON (after stripping code fences and chatty text, as the import does). */
  function formatJson() {
    try {
      const { data, fixedQuotes } = parseJsonLoose(json);
      setJson(JSON.stringify(data, null, 2));
      const n = (data as { questions?: unknown })?.questions;
      const quotesNote = fixedQuotes ? " Curly “smart” quotes were replaced with straight ones." : "";
      setFormatMsg({
        ok: true,
        text: Array.isArray(n)
          ? `Formatted: ${n.length} question${n.length === 1 ? "" : "s"} found.${quotesNote}`
          : Array.isArray(data)
            ? "Formatted, but this is a bare list. Wrap it as { \"questions\": [ … ] } to import it."
            : "Formatted, but there is no \"questions\" list in it.",
      });
    } catch (err) {
      setFormatMsg({ ok: false, text: `Not valid JSON yet: ${(err as Error).message}` });
    }
  }

  async function loadJsonFile(f: File | undefined) {
    if (!f) return;
    setJson(await f.text());
    setFormatMsg(null);
  }

  return (
    <form onSubmit={onSubmit} className="card mt-6 space-y-5">
      <div>
        <span className="label">Question source</span>
        <div className="segmented">
          {(["llm", "import"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSource(s)}
              className={source === s ? "segment-active" : "segment"}
            >
              {s === "llm" ? "Generate with LLM" : "Import JSON"}
            </button>
          ))}
        </div>
        {source === "import" && (
          <p className="mt-2 text-xs text-stone-500">
            Backup option: paste questions JSON produced elsewhere (e.g. by running the prompt in a chatbot). It is
            validated exactly like LLM output.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="title" className="label">
          Lecture title
        </label>
        <input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Week 5: Normalization" required />
      </div>

      <div>
        <span className="label">Lecture notes</span>
        <div className="segmented">
          {(["pdf", "text"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setNotesMode(m)}
              className={notesMode === m ? "segment-active" : "segment"}
            >
              {m === "pdf" ? "Upload PDF" : "Paste text"}
            </button>
          ))}
        </div>
        <div className="mt-3">
          {notesMode === "pdf" ? (
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => choosePdf(e.target.files?.[0] ?? null)}
              className="block w-full cursor-pointer rounded-xl border-2 border-dashed border-stone-400 bg-stone-50/60 p-4 text-sm text-stone-600 transition hover:border-brand-300 hover:bg-brand-50/40 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand-600 file:px-3.5 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-700"
            />
          ) : (
            <textarea
              rows={10}
              className="input font-mono text-sm"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the lecture notes here…"
            />
          )}
          {notesMode === "pdf" && pdf.status !== "idle" && <PdfPreview pdf={pdf} />}
          <p className="mt-1.5 text-xs text-stone-500">
            {notesMode === "pdf"
              ? "Text-based PDFs only (max 10 MB). For scanned slides, paste the text instead."
              : null}
            {source === "import" && " The notes are still required: excerpts are checked against them, and expert review highlights them."}
          </p>
        </div>
      </div>

      <div className="max-w-40">
        <label htmlFor="count" className="label">
          Number of questions
        </label>
        <input id="count" type="number" min={1} max={30} className="input" value={count} onChange={(e) => setCount(Number(e.target.value))} />
        {source === "import" && <p className="mt-1 text-xs text-stone-500">Used only in the copied prompt.</p>}
      </div>

      {source === "import" && (
        <>
          <div className="rounded-md border-2 border-line bg-brand-50/50 p-4">
            <p className="text-sm font-semibold text-brand-900">Need the JSON? Use the exact study prompt.</p>
            <p className="mt-1 text-xs text-stone-500">
              Copies the system prompt and lecture notes from <code>lib/prompts.ts</code> so the questions are produced the same way.
              {notesMode === "pdf" && pdf.status === "reading" && " Reading the PDF…"}
              {notesMode === "pdf" && pdf.status === "idle" && " Choose a PDF above first."}
            </p>
            <button type="button" onClick={copyPrompt} disabled={!notesText} className="btn-secondary mt-3">
              {copied ? "Copied!" : "Copy prompt"}
            </button>
          </div>

          <div>
            <label htmlFor="json" className="label">
              Questions JSON
            </label>
            <textarea
              id="json"
              rows={12}
              className="input font-mono text-xs"
              value={json}
              onChange={(e) => {
                setJson(e.target.value);
                setFormatMsg(null);
              }}
              placeholder={JSON_EXAMPLE}
              spellCheck={false}
            />
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-stone-500">
              <button type="button" onClick={formatJson} disabled={!json.trim()} className="btn-secondary">
                Format JSON
              </button>
              <label className="btn-secondary cursor-pointer">
                Load .json file
                <input type="file" accept="application/json,.json,.txt" className="sr-only" onChange={(e) => loadJsonFile(e.target.files?.[0])} />
              </label>
              <span>Code fences and surrounding text are stripped automatically.</span>
            </div>
            {formatMsg && (
              <p role="status" className={`mt-2 text-xs ${formatMsg.ok ? "text-emerald-800" : "text-rose-700"}`}>
                {formatMsg.text}
              </p>
            )}
          </div>

          <div className="max-w-sm">
            <label htmlFor="model" className="label">
              Model used <span className="font-normal text-stone-500">(recorded with the questions)</span>
            </label>
            <input id="model" className="input" value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. claude-opus-5-5 via claude.ai" />
            <p className="mt-1 text-xs text-stone-500">Leave blank to record “manual-import”.</p>
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="rounded-md border-2 border-line bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={!ready || busy} className="btn-primary">
          {source === "llm" ? (busy ? "Generating…" : "Generate questions") : busy ? "Importing…" : "Import questions"}
        </button>
      </div>
      {busy && progress && <GenerationProgress progress={progress} />}
    </form>
  );
}

/** Reads the newline-delimited JSON events; resolves with the new lecture id or throws the error event. */
async function readEvents(body: ReadableStream<Uint8Array>, onEvent: (e: GenerateEvent) => void): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = done ? "" : (lines.pop() ?? "");
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as GenerateEvent;
      if (event.type === "error") throw new Error(event.error);
      if (event.type === "done") return event.lectureId;
      onEvent(event);
    }
    if (done) throw new Error("The connection closed before generation finished. The request may have timed out; please try again.");
  }
}

function formatDuration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
}

function GenerationProgress({ progress: p }: { progress: Progress }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const elapsed = now - p.startedAt;
  // A question counts as finished once the model has moved on to the next one.
  const finished = Math.min(p.total, Math.max(0, p.started - 1));

  let pct: number;
  let status: string;
  let eta: string;
  if (p.phase === "saving") {
    pct = 97;
    status = "Checking excerpts against your notes and saving…";
    eta = "Almost done";
  } else if (p.phase === "reading") {
    // Before the first question appears the model is reading the notes; creep slowly so the bar isn't frozen.
    pct = Math.min(8, 2 + elapsed / 4000);
    status = p.attempt > 1 ? "The first answer wasn't valid JSON. Asking the model again…" : "Uploading and reading your notes…";
    eta = "Estimating time left…";
  } else {
    pct = 8 + 87 * (finished / p.total);
    status = `Writing question ${Math.min(p.started, p.total)} of ${p.total}`;
    if (finished >= 1 && p.firstQuestionAt) {
      const perQuestion = (now - p.firstQuestionAt) / finished;
      const left = perQuestion * (p.total - finished);
      eta = left < 5000 ? "A few seconds left" : `About ${formatDuration(left)} left`;
    } else {
      eta = "Estimating time left…";
    }
  }
  pct = Math.round(pct);

  return (
    <div className="rounded-md border-2 border-line bg-field p-4" aria-live="polite">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-semibold text-ink">{status}</p>
        <p className="font-display text-2xl text-ink tabular-nums">{pct}%</p>
      </div>
      <div
        role="progressbar"
        aria-label="Question generation"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="mt-2 h-4 overflow-hidden rounded-sm border-2 border-line bg-surface"
      >
        <div className="stripes h-full bg-brand-600 transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-x-4 text-xs text-stone-500 tabular-nums">
        <span>{eta}</span>
        <span>Elapsed {formatDuration(elapsed)}{p.attempt > 1 ? " · attempt 2" : ""}</span>
      </div>
      <p className="mt-2 text-xs text-stone-500">Keep this tab open. You&apos;ll go to the new questions when it finishes.</p>
    </div>
  );
}

const MIN_NOTES_CHARS = 200; // same minimum the server enforces

/** Shows what was read out of the PDF, so the admin can check it before generating or copying the prompt. */
function PdfPreview({ pdf }: { pdf: { status: string; text: string; error?: string } }) {
  if (pdf.status === "reading") return <p className="mt-2 text-sm text-stone-500">Reading text from the PDF…</p>;
  if (pdf.status === "error")
    return <p className="mt-2 rounded-md border-2 border-line bg-rose-50 px-3 py-2 text-sm text-rose-800">{pdf.error}</p>;
  const words = pdf.text.split(/\s+/).filter(Boolean).length;
  const tooShort = pdf.text.length < MIN_NOTES_CHARS;
  return (
    <details className="mt-2 rounded-md border-2 border-line bg-field" open={tooShort}>
      <summary className="cursor-pointer px-3 py-2 text-sm">
        <span className="font-semibold text-ink">Text found:</span>{" "}
        <span className="text-stone-600 tabular-nums">
          {words.toLocaleString()} words · {pdf.text.length.toLocaleString()} characters
        </span>{" "}
        <span className="text-stone-500">(click to preview)</span>
      </summary>
      {tooShort && (
        <p className="mx-3 mb-2 text-sm text-amber-800">
          Very little text was found. If the PDF is scanned slides or images, switch to “Paste text” instead.
        </p>
      )}
      <pre className="max-h-64 overflow-auto border-t-2 border-line px-3 py-2 font-mono text-xs whitespace-pre-wrap text-stone-700">
        {pdf.text || "(no text)"}
      </pre>
    </details>
  );
}
