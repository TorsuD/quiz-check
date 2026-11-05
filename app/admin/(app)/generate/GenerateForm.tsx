"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/prompts";

type Source = "llm" | "import";
type NotesMode = "pdf" | "text";

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
  const [text, setText] = useState("");
  const [json, setJson] = useState("");
  const [model, setModel] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    try {
      const res = await fetch("/api/admin/generate", { method: "POST", body: form });
      const data = await res.json().catch(() => ({ error: `Server error (${res.status}). The request may have timed out.` }));
      if (!res.ok) throw new Error(data.error ?? "Request failed.");
      router.push(`/admin/lectures/${data.lectureId}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function copyPrompt() {
    const prompt = `${SYSTEM_PROMPT}\n\n${buildUserPrompt(title.trim() || "Untitled lecture", text.trim(), count)}`;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function loadJsonFile(f: File | undefined) {
    if (!f) return;
    setJson(await f.text());
  }

  return (
    <form onSubmit={onSubmit} className="card mt-6 space-y-5">
      <div>
        <span className="label">Question source</span>
        <div className="inline-flex rounded-lg border border-stone-300 p-0.5 text-sm">
          {(["llm", "import"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSource(s)}
              className={`rounded-md px-3 py-1.5 ${source === s ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-100"}`}
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
        <div className="inline-flex rounded-lg border border-stone-300 p-0.5 text-sm">
          {(["pdf", "text"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setNotesMode(m)}
              className={`rounded-md px-3 py-1.5 ${notesMode === m ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-100"}`}
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
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-stone-700 file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-stone-200"
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
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-800">Need the JSON? Use the exact study prompt.</p>
            <p className="mt-1 text-xs text-stone-500">
              Copies the system prompt and lecture notes from <code>lib/prompts.ts</code> so the questions are produced the same way.
              {notesMode === "pdf" && " Switch notes to “Paste text” to include them."}
            </p>
            <button type="button" onClick={copyPrompt} disabled={notesMode !== "text" || !text.trim()} className="btn-secondary mt-3">
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
              onChange={(e) => setJson(e.target.value)}
              placeholder={JSON_EXAMPLE}
              spellCheck={false}
            />
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-stone-500">
              <label className="btn-secondary cursor-pointer">
                Load .json file
                <input type="file" accept="application/json,.json,.txt" className="sr-only" onChange={(e) => loadJsonFile(e.target.files?.[0])} />
              </label>
              <span>Code fences and surrounding text are stripped automatically.</span>
            </div>
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
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={!ready || busy} className="btn-primary">
          {source === "llm" ? (busy ? "Generating…" : "Generate questions") : busy ? "Importing…" : "Import questions"}
        </button>
        {busy && source === "llm" && <span className="text-sm text-stone-500">This can take a minute. Keep this tab open.</span>}
      </div>
    </form>
  );
}
