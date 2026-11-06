"use client";

import { useState, useTransition } from "react";
import { CheckIcon, SaveIcon } from "@/components/icons";
import { ERROR_TAGS, type ErrorTag } from "@/lib/constants";
import { saveExpertReview } from "@/app/admin/review-actions";

type Factual = "yes" | "partially" | "no";
type Key = "yes" | "no";

type Values = {
  factuallyCorrect: Factual | null;
  answerKeyCorrect: Key | null;
  relevance: number | null;
  clarity: number | null;
  errorTags: ErrorTag[];
  otherNote: string;
};

const SCALE = [1, 2, 3, 4, 5];

function Choice<T extends string | number>({
  name,
  value,
  options,
  onChange,
  tone,
}: {
  name: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  tone?: (v: T) => string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`min-w-10 rounded-md border-2 px-3 py-1.5 text-sm font-semibold transition ${
              active
                ? (tone?.(o.value) ?? "border-line bg-brand-600 text-white shadow-xs")
                : "border-stone-300 bg-field text-stone-700 hover:border-line hover:bg-yellow-50"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const verdictTone = (v: string) =>
  v === "yes"
    ? "border-line bg-emerald-500 text-white shadow-xs"
    : v === "partially"
      ? "border-line bg-amber-500 text-white shadow-xs"
      : "border-line bg-rose-600 text-white shadow-xs";

export default function ReviewForm({
  quizId,
  questionId,
  reviewer,
  initial,
}: {
  quizId: string;
  questionId: string;
  reviewer: string;
  initial: (Omit<Values, "factuallyCorrect" | "answerKeyCorrect" | "relevance" | "clarity"> & {
    factuallyCorrect: Factual;
    answerKeyCorrect: Key;
    relevance: number;
    clarity: number;
    savedAt: string;
  }) | null;
}) {
  const empty: Values = { factuallyCorrect: null, answerKeyCorrect: null, relevance: null, clarity: null, errorTags: [], otherNote: "" };
  const [values, setValues] = useState<Values>(initial ?? empty);
  const [saved, setSaved] = useState<Values | null>(initial);
  const [savedAt, setSavedAt] = useState<string | null>(initial?.savedAt ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof Values>(k: K, v: Values[K]) => {
    setValues((prev) => ({ ...prev, [k]: v }));
    setError(null);
  };
  const toggleTag = (t: ErrorTag) =>
    set("errorTags", values.errorTags.includes(t) ? values.errorTags.filter((x) => x !== t) : [...values.errorTags, t]);

  const complete =
    values.factuallyCorrect !== null && values.answerKeyCorrect !== null && values.relevance !== null && values.clarity !== null;
  const snapshot = (v: Values) =>
    JSON.stringify([v.factuallyCorrect, v.answerKeyCorrect, v.relevance, v.clarity, [...v.errorTags].sort(), v.otherNote.trim()]);
  // Unsaved forms can be submitted as soon as anything is entered, so missing answers get an explanation.
  const isDirty = saved ? snapshot(values) !== snapshot(saved) : snapshot(values) !== snapshot(empty);
  const looksAccurate = values.factuallyCorrect === "yes" && values.answerKeyCorrect === "yes";

  function save() {
    if (!complete) {
      setError("Answer all four questions before saving.");
      return;
    }
    startTransition(async () => {
      const res = await saveExpertReview({
        quizId,
        questionId,
        reviewer,
        factuallyCorrect: values.factuallyCorrect!,
        answerKeyCorrect: values.answerKeyCorrect!,
        relevance: values.relevance!,
        clarity: values.clarity!,
        errorTags: values.errorTags,
        otherNote: values.otherNote,
      });
      if (res.ok) {
        setSaved({ ...values });
        setSavedAt(res.savedAt);
      } else setError(res.error);
    });
  }

  return (
    <div className="mt-5 border-t-2 border-dashed border-stone-300 pt-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <fieldset>
          <legend className="label">Factually correct?</legend>
          <Choice
            name="Factually correct"
            value={values.factuallyCorrect}
            onChange={(v) => set("factuallyCorrect", v)}
            tone={verdictTone}
            options={[
              { value: "yes", label: "Yes" },
              { value: "partially", label: "Partially" },
              { value: "no", label: "No" },
            ]}
          />
        </fieldset>
        <fieldset>
          <legend className="label">Is the marked answer correct?</legend>
          <Choice
            name="Answer key correct"
            value={values.answerKeyCorrect}
            onChange={(v) => set("answerKeyCorrect", v)}
            tone={verdictTone}
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
          />
        </fieldset>
        <fieldset>
          <legend className="label">Relevance to the lecture (1–5)</legend>
          <Choice name="Relevance" value={values.relevance} onChange={(v) => set("relevance", v)} options={SCALE.map((n) => ({ value: n, label: String(n) }))} />
          <p className="mt-1 text-[11px] text-stone-500">1 = off-topic · 5 = core lecture content</p>
        </fieldset>
        <fieldset>
          <legend className="label">Clarity of wording (1–5)</legend>
          <Choice name="Clarity" value={values.clarity} onChange={(v) => set("clarity", v)} options={SCALE.map((n) => ({ value: n, label: String(n) }))} />
          <p className="mt-1 text-[11px] text-stone-500">1 = confusing · 5 = perfectly clear</p>
        </fieldset>
      </div>

      <fieldset className="mt-5">
        <legend className="label">
          Problems found <span className="font-normal tracking-normal normal-case">(select any that apply)</span>
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {ERROR_TAGS.map((t) => {
            const on = values.errorTags.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => toggleTag(t)}
                className={`rounded-sm border-2 px-2.5 py-1 text-xs font-semibold capitalize transition ${
                  on ? "border-line bg-rose-200 text-ink shadow-xs" : "border-stone-300 bg-field text-stone-600 hover:border-line"
                }`}
              >
                {on && "✕ "}
                {t}
              </button>
            );
          })}
        </div>
        {!looksAccurate && complete && values.errorTags.length === 0 && (
          <p className="mt-2 text-xs text-amber-800">Tip: tag what went wrong so errors can be categorised in the results.</p>
        )}
      </fieldset>

      <div className="mt-4">
        <label htmlFor={`note-${questionId}`} className="label">
          Note {values.errorTags.includes("other") ? "(required for “other”)" : "(optional)"}
        </label>
        <textarea
          id={`note-${questionId}`}
          rows={2}
          maxLength={2000}
          value={values.otherNote}
          onChange={(e) => set("otherNote", e.target.value)}
          className="input text-sm"
          placeholder="What is wrong, or anything worth recording"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={pending || !isDirty} className="btn-primary">
          <SaveIcon /> {pending ? "Saving…" : saved ? "Update score" : "Save score"}
        </button>
        {error ? (
          <p role="alert" className="text-sm text-rose-700">
            {error}
          </p>
        ) : isDirty && saved ? (
          <p className="text-sm text-amber-800">Unsaved changes</p>
        ) : saved && savedAt ? (
          <p className="flex items-center gap-1.5 text-sm text-emerald-700">
            <CheckIcon /> Saved {new Date(savedAt).toLocaleString()}
          </p>
        ) : (
          <p className="text-sm text-stone-500">Not scored yet</p>
        )}
      </div>
    </div>
  );
}
