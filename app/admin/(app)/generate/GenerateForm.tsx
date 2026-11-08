"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { GenerateEvent } from "@/app/api/admin/generate/route";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/prompts";
import { parseJsonLoose } from "@/lib/text";
import { toast } from "@/components/toast";
import { AlertIcon, CheckIcon, CodeIcon, FileIcon, SparklesIcon, TextIcon, UploadIcon, XIcon } from "@/components/icons";

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

export type LLMInfo = { provider: string; model: string; configured: boolean };

const COUNT_PRESETS = [5, 10, 15, 20];
const MAX_PDF_MB = 10;

export default function GenerateForm({ llm }: { llm: LLMInfo }) {
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

  const notesChars = notesMode === "pdf" ? pdf.text.length : text.trim().length;
  const notesWords = useMemo(
    () => (notesMode === "pdf" ? pdf.text : text).split(/\s+/).filter(Boolean).length,
    [notesMode, pdf.text, text],
  );
  const hasNotes = notesMode === "pdf" ? pdf.status === "ok" && notesChars >= MIN_NOTES_CHARS : notesChars >= MIN_NOTES_CHARS;
  // Live check of the pasted JSON for the summary panel (the server validates every field on import).
  const jsonCheck = useMemo(() => {
    if (!json.trim()) return null;
    try {
      const q = (parseJsonLoose(json).data as { questions?: unknown })?.questions;
      return Array.isArray(q) && q.length > 0 ? { ok: true as const, n: q.length } : { ok: false as const };
    } catch {
      return { ok: false as const };
    }
  }, [json]);
  const countOk = Number.isInteger(count) && count >= 1 && count <= 30;
  const ready = Boolean(title.trim()) && hasNotes && (source === "llm" ? countOk && llm.configured : jsonCheck?.ok === true);

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
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      return toast.error("Couldn't copy to the clipboard. Check the browser's clipboard permission.");
    }
    toast("Prompt copied. Paste it into your chatbot.");
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

  const checklist: { label: string; done: boolean; detail?: string }[] = [
    { label: "Lecture title", done: Boolean(title.trim()), detail: title.trim() || undefined },
    {
      label: "Lecture notes",
      done: hasNotes,
      detail:
        notesMode === "pdf" && pdf.status === "reading"
          ? "Reading PDF…"
          : notesChars > 0
            ? `${notesWords.toLocaleString()} words`
            : undefined,
    },
    source === "llm"
      ? { label: "Number of questions", done: countOk, detail: countOk ? String(count) : "1–30" }
      : {
          label: "Questions JSON",
          done: jsonCheck?.ok === true,
          detail: jsonCheck ? (jsonCheck.ok ? `${jsonCheck.n} questions` : "Not valid yet") : undefined,
        },
  ];

  return (
    <form onSubmit={onSubmit} className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      <div className="space-y-6">
        {/* 1. Source */}
        <Step n={1} title="How should the questions be made?">
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Question source">
            <SourceCard
              active={source === "llm"}
              onSelect={() => setSource("llm")}
              icon={<SparklesIcon />}
              title="Generate with AI"
              text={llm.configured ? `${llm.model} writes them from your notes.` : "Needs LLM_API_KEY on the server."}
            />
            <SourceCard
              active={source === "import"}
              onSelect={() => setSource("import")}
              icon={<CodeIcon />}
              title="Import JSON"
              text="Paste questions made with the study prompt in any chatbot."
            />
          </div>
        </Step>

        {/* 2. Lecture */}
        <Step n={2} title="Lecture">
          <label htmlFor="title" className="label">
            Title
          </label>
          <input
            id="title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Week 5: Normalization"
            required
          />

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <span className="label mb-0">Notes</span>
            <div className="segmented" role="tablist" aria-label="Notes format">
              {(
                [
                  ["pdf", "Upload PDF", <UploadIcon key="i" />],
                  ["text", "Paste text", <TextIcon key="i" />],
                ] as const
              ).map(([m, label, icon]) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={notesMode === m}
                  onClick={() => setNotesMode(m)}
                  className={`${notesMode === m ? "segment-active" : "segment"} inline-flex items-center gap-1.5`}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3">
            {notesMode === "pdf" ? (
              <PdfDropzone file={file} pdf={pdf} onFile={choosePdf} />
            ) : (
              <>
                <textarea
                  rows={12}
                  className="input text-sm leading-relaxed"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste the lecture notes here…"
                />
                <p className={`mt-1.5 text-xs tabular-nums ${notesChars > 0 && notesChars < MIN_NOTES_CHARS ? "text-amber-700" : "text-stone-500"}`}>
                  {notesWords.toLocaleString()} words · {notesChars.toLocaleString()} characters
                  {notesChars > 0 && notesChars < MIN_NOTES_CHARS && ` · at least ${MIN_NOTES_CHARS} characters needed`}
                </p>
              </>
            )}
            {source === "import" && (
              <p className="mt-2 text-xs text-stone-500">
                Notes are still needed: quoted excerpts are checked against them, and expert reviewers read them.
              </p>
            )}
          </div>
        </Step>

        {/* 3. Questions */}
        <Step n={3} title={source === "llm" ? "Questions" : "Import"}>
          <span className="label">{source === "llm" ? "How many questions?" : "Questions to ask for in the prompt"}</span>
          <CountPicker value={count} onChange={setCount} />

          {source === "import" && (
            <div className="mt-6 space-y-6">
              <div className="rounded-lg border-2 border-line bg-brand-50/60 p-4">
                <p className="text-sm font-semibold text-ink">Use the exact study prompt</p>
                <p className="mt-1 text-xs text-stone-600">
                  Copies the same instructions the built-in AI uses, plus your title and notes, so imported questions are made the same way.
                  {notesMode === "pdf" && pdf.status === "reading" && " Reading the PDF…"}
                  {!notesText && pdf.status !== "reading" && " Add your notes first."}
                </p>
                <button type="button" onClick={copyPrompt} disabled={!notesText} className="btn-secondary mt-3">
                  {copied ? <CheckIcon /> : null} {copied ? "Copied" : "Copy prompt"}
                </button>
              </div>

              <div>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="json" className="label mb-0">
                    Questions JSON
                  </label>
                  <div className="flex gap-2">
                    <button type="button" onClick={formatJson} disabled={!json.trim()} className="btn-secondary px-3 py-1.5 text-xs">
                      Format
                    </button>
                    <label className="btn-secondary cursor-pointer px-3 py-1.5 text-xs">
                      Load file
                      <input type="file" accept="application/json,.json,.txt" className="sr-only" onChange={(e) => loadJsonFile(e.target.files?.[0])} />
                    </label>
                  </div>
                </div>
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
                {formatMsg ? (
                  <p role="status" className={`mt-1.5 text-xs ${formatMsg.ok ? "text-emerald-700" : "text-rose-700"}`}>
                    {formatMsg.text}
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-stone-500">Code fences, chatty text and curly quotes are cleaned up automatically.</p>
                )}
              </div>

              <div className="max-w-sm">
                <label htmlFor="model" className="label">
                  Model used
                </label>
                <input id="model" className="input" value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. claude-opus-5-5 via claude.ai" />
                <p className="mt-1.5 text-xs text-stone-500">Saved with the questions for the study. Blank records “manual-import”.</p>
              </div>
            </div>
          )}
        </Step>
      </div>

      {/* Summary + action: sticky beside the form on wide screens, after it on phones. */}
      <aside className="card space-y-5 lg:sticky lg:top-8">
        {busy && progress ? (
          <GenerationProgress progress={progress} />
        ) : (
          <>
            <div>
              <p className="label">Ready to {source === "llm" ? "generate" : "import"}?</p>
              <ul className="space-y-2.5">
                {checklist.map((c) => (
                  <li key={c.label} className="flex items-start gap-2.5 text-sm">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                        c.done ? "bg-emerald-500 text-white" : "border-2 border-stone-300"
                      }`}
                    >
                      {c.done && <CheckIcon strokeWidth={3.5} />}
                    </span>
                    <span className="min-w-0">
                      <span className={c.done ? "text-ink" : "text-stone-500"}>{c.label}</span>
                      {c.detail && <span className="block truncate text-xs text-stone-500">{c.detail}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {source === "llm" && (
              <div className="rounded-lg bg-stone-50 px-3 py-2.5 text-xs text-stone-600">
                {llm.configured ? (
                  <>
                    Model <span className="font-mono font-medium text-ink">{llm.model}</span>
                    <span className="block text-stone-500">via {llm.provider} · usually under a minute</span>
                  </>
                ) : (
                  <span className="flex items-start gap-1.5 text-amber-800">
                    <AlertIcon className="mt-0.5 shrink-0" /> No API key configured on the server. Use Import JSON instead.
                  </span>
                )}
              </div>
            )}

            {error && (
              <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
                {error}
              </p>
            )}

            <button type="submit" disabled={!ready || busy} className="btn-primary w-full py-3">
              {source === "llm" ? <SparklesIcon /> : <CodeIcon />}
              {source === "llm" ? (busy ? "Generating…" : `Generate ${countOk ? count : ""} questions`) : busy ? "Importing…" : "Import questions"}
            </button>
            <p className="text-center text-xs text-stone-500">You&apos;ll review every question before anything is published.</p>
          </>
        )}
      </aside>
    </form>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="card">
      <h2 className="mb-4 flex items-center gap-3 text-lg">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function SourceCard({
  active,
  onSelect,
  icon,
  title,
  text,
}: {
  active: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={`relative flex items-start gap-3 rounded-lg border-2 p-4 text-left transition ${
        active ? "border-brand-600 bg-brand-50/70 ring-4 ring-brand-600/10" : "border-line bg-field hover:border-brand-300"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg ${
          active ? "bg-brand-600 text-white" : "bg-stone-100 text-stone-500"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 pr-5">
        <span className="block font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-stone-500">{text}</span>
      </span>
      {active && (
        <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[11px] text-white">
          <CheckIcon strokeWidth={3.5} />
        </span>
      )}
    </button>
  );
}

function CountPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const clamp = (n: number) => Math.min(30, Math.max(1, n));
  return (
    <div className="flex flex-wrap items-center gap-2">
      {COUNT_PRESETS.map((n) => (
        <button
          key={n}
          type="button"
          aria-pressed={value === n}
          onClick={() => onChange(n)}
          className={`h-10 min-w-12 rounded-lg border-2 px-3 text-sm font-semibold tabular-nums transition ${
            value === n ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-field text-stone-700 hover:border-brand-300"
          }`}
        >
          {n}
        </button>
      ))}
      <div className="flex h-10 items-center rounded-lg border-2 border-line bg-field">
        <button type="button" aria-label="Fewer" onClick={() => onChange(clamp(value - 1))} className="h-full px-3 text-stone-500 hover:text-ink">
          −
        </button>
        <input
          id="count"
          type="number"
          min={1}
          max={30}
          aria-label="Number of questions"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-10 bg-transparent text-center text-sm font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button type="button" aria-label="More" onClick={() => onChange(clamp(value + 1))} className="h-full px-3 text-stone-500 hover:text-ink">
          +
        </button>
      </div>
      <span className="text-xs text-stone-500">1–30</span>
    </div>
  );
}

function formatBytes(n: number) {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Drag-and-drop (or click) PDF picker, with the chosen file and what was read from it. */
function PdfDropzone({
  file,
  pdf,
  onFile,
}: {
  file: File | null;
  pdf: { status: string; text: string; error?: string };
  onFile: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function take(f: File | undefined | null) {
    if (!f) return;
    if (f.type && f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("That isn't a PDF. Choose a .pdf file, or paste the text instead.");
      return;
    }
    if (f.size > MAX_PDF_MB * 1024 * 1024) {
      toast.error(`That PDF is larger than ${MAX_PDF_MB} MB. Paste the text instead.`);
      return;
    }
    onFile(f);
  }

  if (file) {
    return (
      <div>
        <div className="flex items-center gap-3 rounded-lg border-2 border-line bg-field p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-lg text-rose-600">
            <FileIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{file.name}</span>
            <span className="block text-xs text-stone-500">
              {formatBytes(file.size)}
              {pdf.status === "reading" && " · reading text…"}
              {pdf.status === "ok" && ` · ${pdf.text.split(/\s+/).filter(Boolean).length.toLocaleString()} words found`}
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              onFile(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            aria-label="Remove PDF"
            className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-ink"
          >
            <XIcon />
          </button>
        </div>
        {pdf.status !== "idle" && <PdfPreview pdf={pdf} />}
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        take(e.dataTransfer.files?.[0]);
      }}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label="Upload a PDF of the lecture notes"
      className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition ${
        dragging ? "border-brand-500 bg-brand-50" : "border-stone-300 bg-stone-50/60 hover:border-brand-400 hover:bg-brand-50/40"
      }`}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-xl text-brand-600">
        <UploadIcon />
      </span>
      <p className="mt-3 text-sm font-semibold text-ink">
        {dragging ? "Drop the PDF here" : <>Drag a PDF here, or <span className="text-brand-600">browse</span></>}
      </p>
      <p className="mt-1 text-xs text-stone-500">Text-based PDFs up to {MAX_PDF_MB} MB. For scanned slides, paste the text instead.</p>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => take(e.target.files?.[0])}
      />
    </div>
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
    <div aria-live="polite">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-semibold text-ink">{status}</p>
        <p className="font-display font-bold text-2xl text-ink tabular-nums">{pct}%</p>
      </div>
      <div
        role="progressbar"
        aria-label="Question generation"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-stone-100"
      >
        <div className="stripes h-full rounded-full bg-brand-600 transition-[width] duration-500" style={{ width: `${pct}%` }} />
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
