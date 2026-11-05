"use client";

import { useEffect, useState } from "react";
import { CONSENT_TEXT, LETTERS, RATING_SCALES, SURVEY, type RatingKey } from "@/lib/constants";

export type PublicQuestion = { id: string; question: string; options: string[] };

type Answer = {
  selectedIndex: number;
  isCorrect: boolean;
  correctIndex: number;
  explanation: string;
  rated: boolean;
};

export type InitialProgress = {
  started: boolean;
  completed: boolean;
  surveyDone: boolean;
  answers: Record<string, Answer>;
};

type Step =
  | { kind: "consent" }
  | { kind: "closed" }
  | { kind: "question"; index: number }
  | { kind: "survey" }
  | { kind: "done"; returning: boolean };

const COMPARISON = ["much worse", "worse", "about the same", "better", "much better"] as const;

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Network problem. Check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Something went wrong. Please try again.");
  return data as T;
}

function resumeStep(questions: PublicQuestion[], initial: InitialProgress, isOpen: boolean): Step {
  if (initial.completed || initial.surveyDone) return { kind: "done", returning: true };
  if (!initial.started) return isOpen ? { kind: "consent" } : { kind: "closed" };
  const next = questions.findIndex((q) => !initial.answers[q.id]?.rated);
  return next === -1 ? { kind: "survey" } : { kind: "question", index: next };
}

export default function QuizFlow({
  quizId,
  title,
  isOpen,
  questions,
  initial,
}: {
  quizId: string;
  title: string;
  isOpen: boolean;
  questions: PublicQuestion[];
  initial: InitialProgress;
}) {
  const [step, setStep] = useState<Step>(() => resumeStep(questions, initial, isOpen));
  const [answers, setAnswers] = useState<Record<string, Answer>>(initial.answers);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const goAfter = (index: number) =>
    setStep(index + 1 < questions.length ? { kind: "question", index: index + 1 } : { kind: "survey" });

  return (
    <div className="flex flex-1 flex-col">
      <header className="mb-5">
        <p className="text-xs font-medium tracking-wide text-stone-500 uppercase">Practice question survey</p>
        <h1 className="mt-0.5 text-lg leading-snug font-semibold text-stone-900">{title}</h1>
        {step.kind === "question" && <ProgressBar current={step.index + 1} total={questions.length} />}
        {step.kind === "survey" && <ProgressBar current={questions.length} total={questions.length} label="Final questions" />}
      </header>

      {step.kind === "consent" && (
        <Consent
          quizId={quizId}
          count={questions.length}
          onStarted={(completed) => setStep(completed ? { kind: "done", returning: true } : resumeStep(questions, { ...initial, started: true }, true))}
        />
      )}
      {step.kind === "closed" && (
        <div className="card text-center">
          <h2 className="text-lg font-semibold">This survey is closed</h2>
          <p className="mt-2 text-stone-600">It is not accepting new responses right now.</p>
        </div>
      )}
      {step.kind === "question" && (
        <QuestionStep
          key={questions[step.index].id}
          quizId={quizId}
          question={questions[step.index]}
          answer={answers[questions[step.index].id]}
          onAnswered={(a) => setAnswers((prev) => ({ ...prev, [questions[step.index].id]: a }))}
          onRated={() => {
            const id = questions[step.index].id;
            setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], rated: true } }));
            goAfter(step.index);
          }}
          isLast={step.index === questions.length - 1}
        />
      )}
      {step.kind === "survey" && <SurveyStep quizId={quizId} onDone={() => setStep({ kind: "done", returning: false })} />}
      {step.kind === "done" && <Done returning={step.returning} />}
    </div>
  );
}

function ProgressBar({ current, total, label }: { current: number; total: number; label?: string }) {
  const pct = total ? Math.round((current / total) * 100) : 0;
  return (
    <div className="mt-3">
      <div className="mb-1 flex justify-between text-xs text-stone-500">
        <span>{label ?? `Question ${current} of ${total}`}</span>
        <span>{label ? "" : `${pct}%`}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
        <div className="h-full rounded-full bg-stone-800 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      {message}
    </p>
  );
}

function Consent({ quizId, count, onStarted }: { quizId: string; count: number; onStarted: (completed: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await postJSON<{ completed: boolean }>(`/api/quiz/${quizId}/start`, {});
      onStarted(res.completed);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2 className="text-base font-semibold">Before you start</h2>
      <p className="mt-3 text-[15px] leading-relaxed text-stone-700">{CONSENT_TEXT}</p>
      <ul className="mt-4 space-y-1.5 text-sm text-stone-600">
        <li>• {count} multiple-choice questions, then a short survey (about 10 minutes).</li>
        <li>• After each answer you will see the explanation and rate the question.</li>
        <li>• Your progress is saved as you go.</li>
      </ul>
      <button onClick={start} disabled={busy} className="btn-primary mt-6 min-h-12 w-full text-base">
        {busy ? "Starting…" : "I agree, start"}
      </button>
      <ErrorNote message={error} />
    </section>
  );
}

type Ratings = Record<RatingKey, number | null>;
const EMPTY_RATINGS: Ratings = { clarity: null, difficulty: null, usefulness: null, perceivedAccuracy: null };

function QuestionStep({
  quizId,
  question,
  answer,
  onAnswered,
  onRated,
  isLast,
}: {
  quizId: string;
  question: PublicQuestion;
  answer: Answer | undefined;
  onAnswered: (a: Answer) => void;
  onRated: () => void;
  isLast: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(answer?.selectedIndex ?? null);
  const [ratings, setRatings] = useState<Ratings>(EMPTY_RATINGS);
  const [flagged, setFlagged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitAnswer() {
    if (selected === null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await postJSON<Omit<Answer, "rated">>(`/api/quiz/${quizId}/answer`, {
        questionId: question.id,
        selectedIndex: selected,
      });
      setSelected(res.selectedIndex);
      onAnswered({ ...res, rated: false });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const allRated = RATING_SCALES.every((s) => ratings[s.key] !== null);

  async function submitRatings() {
    if (!allRated) return;
    setBusy(true);
    setError(null);
    try {
      await postJSON(`/api/quiz/${quizId}/rate`, { questionId: question.id, ...ratings, flaggedError: flagged });
      onRated();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const answered = Boolean(answer);

  return (
    <div className="space-y-4">
      <section className="card">
        <h2 className="text-[17px] leading-relaxed font-medium text-stone-900">{question.question}</h2>
        <div className="mt-4 space-y-2.5" role="radiogroup" aria-label="Answer options">
          {question.options.map((opt, i) => {
            let tone = "border-stone-300 bg-white hover:border-stone-400";
            if (!answered && selected === i) tone = "border-stone-900 bg-stone-50 ring-2 ring-stone-900";
            if (answered) {
              if (i === answer!.correctIndex) tone = "border-emerald-600 bg-emerald-50";
              else if (i === answer!.selectedIndex) tone = "border-red-500 bg-red-50";
              else tone = "border-stone-200 bg-white opacity-70";
            }
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={selected === i}
                disabled={answered || busy}
                onClick={() => setSelected(i)}
                className={`flex min-h-14 w-full items-start gap-3 rounded-lg border px-3.5 py-3 text-left text-[15px] leading-snug transition-colors ${tone}`}
              >
                <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs font-semibold">
                  {LETTERS[i]}
                </span>
                <span className="min-w-0 flex-1 break-words">{opt}</span>
                {answered && i === answer!.correctIndex && <span className="shrink-0 text-sm font-medium text-emerald-700">Correct</span>}
                {answered && i === answer!.selectedIndex && !answer!.isCorrect && (
                  <span className="shrink-0 text-sm font-medium text-red-700">Your answer</span>
                )}
              </button>
            );
          })}
        </div>
        {!answered && (
          <button onClick={submitAnswer} disabled={selected === null || busy} className="btn-primary mt-5 min-h-12 w-full text-base">
            {busy ? "Checking…" : "Check answer"}
          </button>
        )}
        {answered && (
          <div
            className={`mt-5 rounded-lg px-4 py-3 ${answer!.isCorrect ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}
            aria-live="polite"
          >
            <p className="font-semibold">
              {answer!.isCorrect ? "Correct!" : `Not quite. The answer is ${LETTERS[answer!.correctIndex]}.`}
            </p>
            <p className="mt-1 text-[15px] leading-relaxed">{answer!.explanation}</p>
          </div>
        )}
        {!answered && <ErrorNote message={error} />}
      </section>

      {answered && (
        <section className="card">
          <h3 className="text-base font-semibold">Rate this question</h3>
          <p className="mt-0.5 text-sm text-stone-500">Rate the question itself, not how you did.</p>
          <div className="mt-4 space-y-6">
            {RATING_SCALES.map((scale) => (
              <ScaleInput
                key={scale.key}
                label={scale.label}
                low={scale.low}
                high={scale.high}
                value={ratings[scale.key]}
                onChange={(v) => setRatings((r) => ({ ...r, [scale.key]: v }))}
              />
            ))}
            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-stone-300 px-3.5 py-3">
              <input
                type="checkbox"
                checked={flagged}
                onChange={(e) => setFlagged(e.target.checked)}
                className="h-5 w-5 shrink-0 accent-stone-900"
              />
              <span className="text-[15px]">I think this question has an error</span>
            </label>
          </div>
          <button onClick={submitRatings} disabled={!allRated || busy} className="btn-primary mt-6 min-h-12 w-full text-base">
            {busy ? "Saving…" : isLast ? "Continue to final questions" : "Next question"}
          </button>
          {!allRated && <p className="mt-2 text-center text-xs text-stone-500">Answer all four scales to continue.</p>}
          <ErrorNote message={error} />
        </section>
      )}
    </div>
  );
}

function ScaleInput({
  label,
  low,
  high,
  value,
  onChange,
}: {
  label: string;
  low: string;
  high: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-[15px] font-medium text-stone-800">{label}</legend>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            aria-label={`${label}: ${n}${n === 1 ? ` (${low})` : n === 5 ? ` (${high})` : ""}`}
            onClick={() => onChange(n)}
            className={`min-h-12 rounded-lg border text-base font-medium transition-colors ${
              value === n ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white text-stone-800 hover:bg-stone-50"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between gap-4 text-xs text-stone-500">
        <span>1 = {low}</span>
        <span className="text-right">5 = {high}</span>
      </div>
    </fieldset>
  );
}

function SurveyStep({ quizId, onDone }: { quizId: string; onDone: () => void }) {
  const [wouldUse, setWouldUse] = useState<number | null>(null);
  const [compared, setCompared] = useState<(typeof COMPARISON)[number] | null>(null);
  const [examHelp, setExamHelp] = useState<number | null>(null);
  const [helpfulText, setHelpfulText] = useState("");
  const [unhelpfulText, setUnhelpfulText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = wouldUse !== null && compared !== null && examHelp !== null;

  async function submit() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await postJSON(`/api/quiz/${quizId}/survey`, {
        wouldUse,
        comparedToInstructor: compared,
        examHelp,
        helpfulText,
        unhelpfulText,
      });
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-7">
      <div>
        <h2 className="text-base font-semibold">Almost done: a few questions about the whole set</h2>
        <p className="mt-0.5 text-sm text-stone-500">Please don&apos;t include your name or student ID.</p>
      </div>
      <ScaleInput label={SURVEY.wouldUse} low="Definitely not" high="Definitely yes" value={wouldUse} onChange={setWouldUse} />

      <fieldset>
        <legend className="mb-2 text-[15px] font-medium text-stone-800">{SURVEY.comparedToInstructor}</legend>
        <div className="space-y-2">
          {COMPARISON.map((opt) => (
            <button
              key={opt}
              type="button"
              aria-pressed={compared === opt}
              onClick={() => setCompared(opt)}
              className={`min-h-12 w-full rounded-lg border px-4 text-left text-[15px] capitalize transition-colors ${
                compared === opt ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white text-stone-800 hover:bg-stone-50"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </fieldset>

      <ScaleInput label={SURVEY.examHelp} low="Not at all" high="A great deal" value={examHelp} onChange={setExamHelp} />

      <div>
        <label htmlFor="helpful" className="mb-2 block text-[15px] font-medium text-stone-800">
          {SURVEY.helpfulText} <span className="font-normal text-stone-500">(optional)</span>
        </label>
        <textarea id="helpful" rows={3} maxLength={3000} value={helpfulText} onChange={(e) => setHelpfulText(e.target.value)} className="input" />
      </div>
      <div>
        <label htmlFor="unhelpful" className="mb-2 block text-[15px] font-medium text-stone-800">
          {SURVEY.unhelpfulText} <span className="font-normal text-stone-500">(optional)</span>
        </label>
        <textarea id="unhelpful" rows={3} maxLength={3000} value={unhelpfulText} onChange={(e) => setUnhelpfulText(e.target.value)} className="input" />
      </div>

      <div>
        <button onClick={submit} disabled={!ready || busy} className="btn-primary min-h-12 w-full text-base">
          {busy ? "Submitting…" : "Submit"}
        </button>
        {!ready && <p className="mt-2 text-center text-xs text-stone-500">The first three questions are required.</p>}
        <ErrorNote message={error} />
      </div>
    </section>
  );
}

function Done({ returning }: { returning: boolean }) {
  return (
    <section className="card py-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700" aria-hidden>
        ✓
      </div>
      <h2 className="mt-4 text-xl font-semibold">Thank you!</h2>
      <p className="mx-auto mt-2 max-w-sm text-stone-600">
        {returning
          ? "You have already completed this survey on this device. Your responses were saved."
          : "Your responses have been recorded. You can close this page."}
      </p>
    </section>
  );
}
