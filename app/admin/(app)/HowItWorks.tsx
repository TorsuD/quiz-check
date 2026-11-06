"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CheckIcon } from "@/components/icons";
import type { AdminProgress } from "@/app/api/admin/progress/route";

type StepState = "done" | "current" | "todo";
type Step = { title: string; detail: string; href: string; state: StepState };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Turns the latest question set's status into the five workflow steps. */
function buildSteps(p: AdminProgress | null): Step[] {
  const lecture = p?.latestLecture ?? null;
  const quiz = p?.latestQuiz ?? null;
  const lectureHref = lecture ? `/admin/lectures/${lecture.id}` : "/admin";
  const quizHref = quiz ? `/admin/quiz/${quiz.id}` : lectureHref;
  const totalQuestions = (lecture ? lecture.kept + lecture.removed : 0);

  const done = [
    Boolean(lecture), // 1. generated
    Boolean(quiz), // 2. reviewed (publishing ends the review)
    Boolean(quiz), // 3. published
    Boolean(quiz && !quiz.isOpen && quiz.completed > 0), // 4. collection finished
    Boolean(quiz && totalQuestions > 0 && quiz.reviewed.every((r) => r.done >= totalQuestions)), // 5. both experts done
    false, // 6. analysis can always be revisited
  ];
  const currentIndex = p ? done.indexOf(false) : -1;
  const state = (i: number): StepState => (done[i] ? "done" : i === currentIndex ? "current" : "todo");

  return [
    {
      title: "Generate questions",
      detail: p && p.lectureCount > 0 ? `${plural(p.lectureCount, "question set")} so far` : "Upload a PDF or paste lecture notes",
      href: "/admin/generate",
      state: state(0),
    },
    {
      title: "Review & remove",
      detail: lecture
        ? `${lecture.kept} kept · ${lecture.removed} removed${quiz ? "" : ", then publish"}`
        : "Remove weak questions, with a reason",
      href: lectureHref,
      state: state(1),
    },
    {
      title: "Publish & share QR",
      detail: quiz ? (quiz.isOpen ? "Live, students can join" : "Survey closed") : "Show the QR code in class",
      href: quiz ? `/admin/present/${quiz.id}` : lectureHref,
      state: state(2),
    },
    {
      title: "Collect responses",
      detail: !quiz
        ? "Students answer, rate and comment"
        : quiz.started === 0
          ? quiz.isOpen
            ? "Waiting for the first student"
            : "No responses yet, reopen the survey"
          : `${quiz.completed} of ${plural(quiz.started, "student")} finished${quiz.isOpen ? ", close when done" : ""}`,
      href: quizHref,
      state: state(3),
    },
    {
      title: "Expert review",
      detail: quiz
        ? quiz.reviewed.map((r) => `${r.name.replace(/^Reviewer /, "")} ${r.done}/${totalQuestions}`).join(" · ")
        : "Two reviewers score accuracy",
      href: quiz ? `/admin/review/${quiz.id}` : lectureHref,
      state: state(4),
    },
    {
      title: "Results & export",
      detail: "Accuracy, agreement, charts, CSV",
      href: quiz ? `/admin/results/${quiz.id}` : quizHref,
      state: state(5),
    },
  ];
}

// Both the desktop sidebar and the mobile drawer render this tracker, so share one request per page.
let inflight: { key: string; at: number; promise: Promise<AdminProgress | null> } | null = null;
function loadProgress(key: string) {
  if (inflight && inflight.key === key && Date.now() - inflight.at < 1500) return inflight.promise;
  const promise = fetch("/api/admin/progress", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<AdminProgress>) : null))
    .catch(() => null);
  inflight = { key, at: Date.now(), promise };
  return promise;
}

function Tracker({ pathname }: { pathname: string | null }) {
  const [progress, setProgress] = useState<AdminProgress | null>(null);

  // Refresh whenever the admin moves to another page or returns to the tab.
  useEffect(() => {
    if (pathname === null) return;
    let active = true;
    const load = () => loadProgress(`${pathname}:${Math.floor(Date.now() / 1500)}`).then((p) => active && p && setProgress(p));
    load();
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.removeEventListener("focus", load);
    };
  }, [pathname]);

  const steps = buildSteps(progress);
  const doneCount = steps.filter((s) => s.state === "done").length;
  const currentIndex = steps.findIndex((s) => s.state === "current");

  const current = currentIndex >= 0 ? steps[currentIndex] : null;

  return (
    <details className="group px-1" aria-label="How it works">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-2 text-[11px] font-semibold tracking-wider text-stone-500 uppercase">
          How it works
          <span className="tabular-nums normal-case">
            {progress ? `${doneCount}/${steps.length}` : ""} <span className="inline-block transition group-open:rotate-90">›</span>
          </span>
        </span>
        {/* One segment per step: green when done, accent for the current one. */}
        <span className="mt-1.5 flex gap-0.5" aria-hidden>
          {steps.map((s) => (
            <span
              key={s.title}
              className={`h-1 flex-1 rounded-xs ${
                s.state === "done" ? "bg-emerald-500" : s.state === "current" ? "bg-brand-600" : "bg-stone-200"
              }`}
            />
          ))}
        </span>
        {current && (
          <span className="mt-1.5 block text-xs text-stone-600">
            Next: <span className="font-semibold text-ink">{current.title}</span>
          </span>
        )}
      </summary>

      <ol className="mt-2 space-y-0.5">
        {steps.map((s, i) => (
          <li key={s.title}>
            <Link
              href={s.href}
              aria-current={s.state === "current" ? "step" : undefined}
              title={s.detail}
              className={`flex items-center gap-2 rounded-sm px-1.5 py-1 text-xs transition hover:bg-field ${
                s.state === "current" ? "bg-yellow-100 font-semibold text-ink" : s.state === "done" ? "text-stone-500" : "text-stone-600"
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-xs text-[9px] font-semibold ${
                  s.state === "done"
                    ? "bg-emerald-500 text-white"
                    : s.state === "current"
                      ? "bg-brand-600 text-white"
                      : "bg-stone-200 text-stone-500"
                }`}
              >
                {s.state === "done" ? <CheckIcon strokeWidth={3.5} /> : i + 1}
              </span>
              <span className="min-w-0">
                {s.title}
                {s.state === "current" && <span className="block text-[11px] leading-snug font-normal text-stone-500">{s.detail}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </details>
  );
}

function LiveTracker() {
  return <Tracker pathname={usePathname()} />;
}

/** Sidebar workflow checklist that reflects the most recent question set. Reading the URL needs Suspense. */
export default function HowItWorks() {
  return (
    <Suspense fallback={<Tracker pathname={null} />}>
      <LiveTracker />
    </Suspense>
  );
}
