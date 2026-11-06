"use client";

import { useEffect, useState } from "react";
import { CheckIcon, ClockIcon, FlagIcon, LockIcon, LogoMark, SaveIcon, ShieldIcon, XIcon } from "@/components/icons";
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

  const correctSoFar = Object.values(answers).filter((a) => a.isCorrect).length;

  return (
    <div className="flex flex-1 flex-col">
      <header className="mb-5">
        <div className="flex items-center gap-3">
          <LogoMark className="h-9 w-9 text-lg" />
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase">Practice question survey</p>
            <h1 className="truncate font-sans text-base leading-snug font-semibold text-stone-900">{title}</h1>
          </div>
        </div>
        {step.kind === "question" && (
          <ProgressBar current={step.index + 1} total={questions.length} correct={correctSoFar} />
        )}
        {step.kind === "survey" && <ProgressBar current={questions.length} total={questions.length} label="Final questions" />}
      </header>

      {step.kind === "consent" && (
        <Consent
          quizId={quizId}
          count={questions.length}
          onStarted={(completed) =>
            setStep(completed ? { kind: "done", returning: true } : resumeStep(questions, { ...initial, started: true }, true))
          }
        />
      )}
      {step.kind === "closed" && (
        <div className="card py-10 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-xl text-stone-500">
            <LockIcon />
          </span>
          <h2 className="mt-4 text-lg font-semibold">This survey is closed</h2>
          <p className="mt-1.5 text-stone-600">It is not accepting new responses right now.</p>
        </div>
      )}
      {step.kind === "question" && (
        <QuestionStep
          key={questions[step.index].id}
          quizId={quizId}
          number={step.index + 1}
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

      <p className="mt-auto pt-8 text-center text-xs text-stone-400">Anonymous · COMP-5112 research project</p>
    </div>
  );
}

function ProgressBar({ current, total, label, correct }: { current: number; total: number; label?: string; correct?: number }) {
  const pct = total ? Math.round((current / total) * 100) : 0;
  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-baseline justify-between text-xs">
        <span className="font-medium text-stone-700">{label ?? `Question ${current} of ${total}`}</span>
        {correct !== undefined && correct > 0 && (
          <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
            <CheckIcon /> {correct} correct
          </span>
        )}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200/70">
        <div
          className="h-full rounded-full stripes bg-brand-600 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-3 rounded-md border-2 border-line bg-rose-100 px-3.5 py-2.5 text-sm text-rose-800">
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

  const facts = [
    { icon: <ClockIcon />, text: `${count} multiple-choice questions, then a short survey (about 10 minutes).` },
    { icon: <CheckIcon />, text: "After each answer you see the explanation, then rate the question." },
    { icon: <SaveIcon />, text: "Your progress is saved as you go." },
  ];

  return (
    <section className="card overflow-hidden p-0 sm:p-0">
      <div className="border-b-2 border-line bg-brand-600 px-5 py-6 text-white sm:px-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-xl">
          <ShieldIcon />
        </span>
        <h2 className="mt-3 text-xl font-semibold">Before you start</h2>
        <p className="mt-1 text-sm text-white/80">Help us find out whether AI-written practice questions are any good.</p>
      </div>
      <div className="px-5 py-5 sm:px-6">
        <p className="rounded-md border-2 border-dashed border-stone-400 bg-paper/60 p-4 text-[15px] leading-relaxed text-stone-800">{CONSENT_TEXT}</p>
        <ul className="mt-5 space-y-3">
          {facts.map((f) => (
            <li key={f.text} className="flex items-start gap-3 text-sm text-stone-600">
              <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">{f.icon}</span>
              {f.text}
            </li>
          ))}
        </ul>
        <button onClick={start} disabled={busy} className="btn-primary mt-6 min-h-12 w-full text-base">
          {busy ? "Starting…" : "I agree, start"}
        </button>
        <ErrorNote message={error} />
      </div>
    </section>
  );
}

type Ratings = Record<RatingKey, number | null>;
const EMPTY_RATINGS: Ratings = { clarity: null, difficulty: null, usefulness: null, perceivedAccuracy: null };

function QuestionStep({
  quizId,
  number,
  question,
  answer,
  onAnswered,
  onRated,
  isLast,
}: {
  quizId: string;
  number: number;
  question: PublicQuestion;
  answer: Answer | undefined;
  onAnswered: (a: Answer) => void;
  onRated: () => void;
  isLast: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(answer?.selectedIndex ?? null);
  const [ratings, setRatings] = useState<Ratings>(EMPTY_RATINGS);
  const [flagged, setFlagged] = useState(false);
  const [errorNote, setErrorNote] = useState("");
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

  const ratedCount = RATING_SCALES.filter((s) => ratings[s.key] !== null).length;
  const allRated = ratedCount === RATING_SCALES.length;

  async function submitRatings() {
    if (!allRated) return;
    setBusy(true);
    setError(null);
    try {
      await postJSON(`/api/quiz/${quizId}/rate`, {
        questionId: question.id,
        ...ratings,
        flaggedError: flagged,
        errorNote: flagged ? errorNote.trim() || undefined : undefined,
      });
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
        <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase">Question {number}</p>
        <h2 className="mt-1.5 font-sans text-[17px] leading-relaxed font-semibold tracking-normal text-stone-900">{question.question}</h2>
        <div className="mt-5 space-y-2.5" role="radiogroup" aria-label="Answer options">
          {question.options.map((opt, i) => {
            const isSelected = selected === i;
            const isCorrectOpt = answered && i === answer!.correctIndex;
            const isWrongPick = answered && i === answer!.selectedIndex && !answer!.isCorrect;

            let row = "border-line bg-field hover:bg-yellow-50";
            let badge = "bg-stone-100 text-stone-600";
            if (!answered && isSelected) {
              row = "border-line bg-brand-50 shadow-sm";
              badge = "bg-brand-600 text-white";
            }
            if (answered) {
              row = "border-stone-300 bg-field opacity-60";
              if (isCorrectOpt) {
                row = "border-line bg-emerald-100 shadow-sm";
                badge = "bg-emerald-600 text-white";
              } else if (isWrongPick) {
                row = "border-line bg-rose-100";
                badge = "bg-rose-500 text-white";
              }
            }
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={answered || busy}
                onClick={() => setSelected(i)}
                className={`flex min-h-14 w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-[15px] leading-snug text-stone-800 transition ${row}`}
              >
                <span className={`mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${badge}`}>
                  {isCorrectOpt ? <CheckIcon strokeWidth={3} /> : isWrongPick ? <XIcon strokeWidth={3} /> : LETTERS[i]}
                </span>
                <span className="min-w-0 flex-1 pt-0.5 break-words">{opt}</span>
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
            className={`mt-5 flex gap-3 rounded-xl p-4 ${
              answer!.isCorrect ? "border-2 border-line bg-emerald-100 text-emerald-950" : "border-2 border-line bg-yellow-100 text-amber-950"
            }`}
            aria-live="polite"
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ${
                answer!.isCorrect ? "bg-emerald-600" : "bg-amber-500"
              }`}
            >
              {answer!.isCorrect ? <CheckIcon strokeWidth={3} /> : <XIcon strokeWidth={3} />}
            </span>
            <div>
              <p className="font-semibold">
                {answer!.isCorrect ? "Correct!" : `Not quite. The answer is ${LETTERS[answer!.correctIndex]}.`}
              </p>
              <p className="mt-1 text-[15px] leading-relaxed opacity-90">{answer!.explanation}</p>
            </div>
          </div>
        )}
        {!answered && <ErrorNote message={error} />}
      </section>

      {answered && (
        <section className="card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Rate this question</h3>
              <p className="mt-0.5 text-sm text-stone-500">Rate the question itself, not how you did.</p>
            </div>
            <span className="pill shrink-0 bg-brand-50 text-brand-700">
              {ratedCount}/{RATING_SCALES.length}
            </span>
          </div>
          <div className="mt-5 space-y-6">
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
            <label
              className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition ${
                flagged ? "border-line bg-yellow-100 text-amber-950" : "border-stone-300 hover:border-line hover:bg-yellow-50"
              }`}
            >
              <input
                type="checkbox"
                checked={flagged}
                onChange={(e) => setFlagged(e.target.checked)}
                className="h-5 w-5 shrink-0 accent-amber-500"
              />
              <span className="flex-1 text-[15px]">I think this question has an error</span>
              <FlagIcon className={flagged ? "text-amber-500" : "text-stone-300"} />
            </label>
            {flagged && (
              <div>
                <label htmlFor={`error-note-${question.id}`} className="mb-1 block text-sm font-medium text-stone-700">
                  What&apos;s wrong with it? <span className="font-normal text-stone-500">(optional)</span>
                </label>
                <textarea
                  id={`error-note-${question.id}`}
                  rows={3}
                  maxLength={1000}
                  value={errorNote}
                  onChange={(e) => setErrorNote(e.target.value)}
                  placeholder="e.g. Two of the options are correct, or the notes say something different."
                  className="input text-[15px]"
                />
              </div>
            )}
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
      <legend className="mb-2.5 text-[15px] font-medium text-stone-800">{label}</legend>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            aria-label={`${label}: ${n}${n === 1 ? ` (${low})` : n === 5 ? ` (${high})` : ""}`}
            onClick={() => onChange(n)}
            className={`min-h-12 rounded-xl border text-base font-semibold transition ${
              value === n
                ? "border-line bg-brand-600 text-white shadow-xs"
                : "border-line bg-field text-stone-800 hover:bg-yellow-50"
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

function SurveySection({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
        {n}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
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
        <h2 className="text-lg font-semibold">Almost done</h2>
        <p className="mt-0.5 text-sm text-stone-500">A few questions about the whole set. Please don&apos;t include your name or student ID.</p>
      </div>
      <SurveySection n={1}>
        <ScaleInput label={SURVEY.wouldUse} low="Definitely not" high="Definitely yes" value={wouldUse} onChange={setWouldUse} />
      </SurveySection>

      <SurveySection n={2}>
        <fieldset>
          <legend className="mb-2.5 text-[15px] font-medium text-stone-800">{SURVEY.comparedToInstructor}</legend>
          <div className="space-y-2">
            {COMPARISON.map((opt) => (
              <button
                key={opt}
                type="button"
                aria-pressed={compared === opt}
                onClick={() => setCompared(opt)}
                className={`flex min-h-12 w-full items-center justify-between rounded-xl border px-4 text-left text-[15px] capitalize transition ${
                  compared === opt
                    ? "border-line bg-brand-600 font-medium text-white shadow-xs"
                    : "border-line bg-field text-stone-800 hover:bg-yellow-50"
                }`}
              >
                {opt}
                {compared === opt && <CheckIcon strokeWidth={3} />}
              </button>
            ))}
          </div>
        </fieldset>
      </SurveySection>

      <SurveySection n={3}>
        <ScaleInput label={SURVEY.examHelp} low="Not at all" high="A great deal" value={examHelp} onChange={setExamHelp} />
      </SurveySection>

      <SurveySection n={4}>
        <label htmlFor="helpful" className="mb-2.5 block text-[15px] font-medium text-stone-800">
          {SURVEY.helpfulText} <span className="font-normal text-stone-400">(optional)</span>
        </label>
        <textarea id="helpful" rows={3} maxLength={3000} value={helpfulText} onChange={(e) => setHelpfulText(e.target.value)} className="input" />
      </SurveySection>
      <SurveySection n={5}>
        <label htmlFor="unhelpful" className="mb-2.5 block text-[15px] font-medium text-stone-800">
          {SURVEY.unhelpfulText} <span className="font-normal text-stone-400">(optional)</span>
        </label>
        <textarea id="unhelpful" rows={3} maxLength={3000} value={unhelpfulText} onChange={(e) => setUnhelpfulText(e.target.value)} className="input" />
      </SurveySection>

      <div>
        <button onClick={submit} disabled={!ready || busy} className="btn-primary min-h-12 w-full text-base">
          {busy ? "Submitting…" : "Submit"}
        </button>
        {!ready && <p className="mt-2 text-center text-xs text-stone-500">Questions 1–3 are required.</p>}
        <ErrorNote message={error} />
      </div>
    </section>
  );
}

function Done({ returning }: { returning: boolean }) {
  return (
    <section className="card py-12 text-center">
      <div className="relative mx-auto h-16 w-16">
        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-200 opacity-40 [animation-iteration-count:2]" />
        <span className="relative flex h-16 w-16 items-center justify-center rounded-md border-2 border-line bg-emerald-500 text-3xl text-white shadow-md">
          <CheckIcon strokeWidth={3} />
        </span>
      </div>
      <h2 className="mt-5 text-2xl font-semibold">Thank you!</h2>
      <p className="mx-auto mt-2 max-w-sm text-stone-600">
        {returning
          ? "You have already completed this survey on this device. Your responses were saved."
          : "Your responses have been recorded. You can close this page."}
      </p>
    </section>
  );
}
