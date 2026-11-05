"use client";

import { useState, useTransition } from "react";
import { publishQuiz, removeQuestion, restoreQuestion } from "@/app/admin/actions";

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
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
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
    <div className="mt-4 rounded-lg border border-red-200 bg-red-50/50 p-4">
      <label htmlFor={`reason-${questionId}`} className="label">
        Why are you removing this question? <span className="font-normal text-stone-500">(required, saved as research data)</span>
      </label>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {QUICK_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            className="rounded-full border border-stone-300 bg-white px-2.5 py-1 text-xs text-stone-700 hover:bg-stone-100"
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
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
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
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
