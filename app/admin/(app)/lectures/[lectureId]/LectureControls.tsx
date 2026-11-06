"use client";

import { useState, useTransition } from "react";
import { deleteLecture, publishQuiz, removeQuestion, restoreQuestion } from "@/app/admin/actions";
import { TrashIcon } from "@/components/icons";

const QUICK_REASONS = ["Factually incorrect", "Wrong answer key", "Ambiguous wording", "Too trivial", "Off-topic", "Duplicate"];

export function RemoveControls({ questionId, removed }: { questionId: string; removed: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (removed) {
    return (
      <div className="mt-4">
        <button
          className="btn-secondary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await restoreQuestion(questionId);
              if (res?.error) setError(res.error);
            })
          }
        >
          {pending ? "Restoring…" : "Restore question"}
        </button>
        {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
      </div>
    );
  }

  if (!open) {
    return (
      <div className="mt-4">
        <button className="btn-danger" onClick={() => setOpen(true)}>
          Remove question…
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-md border-2 border-line bg-rose-50/50 p-4">
      <label htmlFor={`reason-${questionId}`} className="label">
        Why are you removing this question? <span className="font-normal text-stone-500">(required, saved as research data)</span>
      </label>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {QUICK_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
              reason === r ? "border-line bg-rose-200 text-ink" : "border-stone-200 bg-field text-stone-600 hover:bg-stone-50"
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <textarea
        id={`reason-${questionId}`}
        rows={2}
        className="input text-sm"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. The answer key is wrong: the notes say B, not C."
      />
      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          className="btn-danger"
          disabled={pending || !reason.trim()}
          onClick={() =>
            startTransition(async () => {
              const res = await removeQuestion(questionId, reason);
              if (res?.error) setError(res.error);
              else setOpen(false);
            })
          }
        >
          {pending ? "Removing…" : "Remove"}
        </button>
        <button className="btn-secondary" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function PublishButton({ lectureId, disabled, count }: { lectureId: string; disabled: boolean; count: number }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="text-right">
      <button
        className="btn-primary"
        disabled={disabled || pending}
        onClick={() => {
          if (!confirm(`Publish ${count} questions as a survey? The set will be locked after publishing.`)) return;
          startTransition(async () => {
            const res = await publishQuiz(lectureId);
            if (res?.error) setError(res.error);
          });
        }}
      >
        {pending ? "Publishing…" : `Publish ${count} questions as survey`}
      </button>
      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
    </div>
  );
}

export function DeleteLecture({
  lectureId,
  title,
  counts,
}: {
  lectureId: string;
  title: string;
  counts: { questions: number; students: number; reviews: number };
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const matches = typed.trim() === title.trim();

  const parts = [
    `${counts.questions} question${counts.questions === 1 ? "" : "s"}`,
    counts.students > 0 && `answers from ${counts.students} student${counts.students === 1 ? "" : "s"}`,
    counts.reviews > 0 && `${counts.reviews} expert review${counts.reviews === 1 ? "" : "s"}`,
  ].filter(Boolean);

  return (
    <section id="delete" className="card mt-10 scroll-mt-20 border-rose-300">
      <h2 className="text-lg">Delete this lecture</h2>
      <p className="mt-1 text-sm text-stone-600">
        Permanently deletes the lecture, its {parts.join(", ")}
        {" "}and the published survey, if any. This cannot be undone.
        {counts.students > 0 && " Download the CSV exports first if you need this data."}
      </p>
      {!open ? (
        <button className="btn-danger mt-4" onClick={() => setOpen(true)}>
          <TrashIcon /> Delete lecture…
        </button>
      ) : (
        <div className="mt-4">
          <label htmlFor="confirm-delete" className="label">
            Type <span className="font-mono normal-case">{title}</span> to confirm
          </label>
          <input
            id="confirm-delete"
            className="input"
            value={typed}
            autoComplete="off"
            onChange={(e) => {
              setTyped(e.target.value);
              setError(null);
            }}
          />
          {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="btn-danger"
              disabled={!matches || pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await deleteLecture(lectureId, typed);
                  if (res?.error) setError(res.error);
                })
              }
            >
              <TrashIcon /> {pending ? "Deleting…" : "Delete permanently"}
            </button>
            <button
              className="btn-secondary"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                setTyped("");
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
