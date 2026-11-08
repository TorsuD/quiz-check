import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { isValidObjectId } from "mongoose";
import { DifficultyPill, LoadingCard, StatusPill } from "@/components/admin-ui";
import {
  AlertIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  FileIcon,
  LockIcon,
  SparklesIcon,
  TextIcon,
  TrashIcon,
} from "@/components/icons";
import { LETTERS } from "@/lib/constants";
import { connectDB } from "@/lib/db";
import { ExpertReview, Lecture, Participant, Question, Quiz } from "@/lib/models";
import { DeleteLecture, PublishButton, RemoveControls } from "./LectureControls";

export default function LecturePage({ params }: PageProps<"/admin/lectures/[lectureId]">) {
  return (
    <Suspense fallback={<LoadingCard />}>
      <LectureDetail params={params} />
    </Suspense>
  );
}

const DIFFICULTY = [
  { id: "easy", label: "Easy", bar: "bg-emerald-500" },
  { id: "medium", label: "Medium", bar: "bg-amber-400" },
  { id: "hard", label: "Hard", bar: "bg-rose-500" },
] as const;

async function LectureDetail({ params }: { params: Promise<{ lectureId: string }> }) {
  await connection(); // database reads must happen at request time, not during prerendering
  const { lectureId } = await params;
  if (!isValidObjectId(lectureId)) return <p>Lecture not found.</p>;
  await connectDB();
  const [lecture, questions, quiz] = await Promise.all([
    Lecture.findById(lectureId, { text: 0 }).lean(),
    Question.find({ lectureId }).sort({ order: 1 }).lean(),
    Quiz.findOne({ lectureId }).lean(),
  ]);
  if (!lecture) return <p>Lecture not found.</p>;

  const [students, reviews] = quiz
    ? await Promise.all([Participant.countDocuments({ quizId: quiz._id }), ExpertReview.countDocuments({ quizId: quiz._id })])
    : [0, 0];

  const active = questions.filter((q) => !q.removedBeforeSurvey);
  const removedCount = questions.length - active.length;
  const locked = Boolean(quiz);
  const first = questions[0];
  const notVerbatim = active.filter((q) => !q.excerptFoundInText).length;
  const status = !quiz ? "draft" : quiz.isOpen ? "open" : "closed";
  const mix = DIFFICULTY.map((d) => ({ ...d, n: active.filter((q) => q.difficulty === d.id).length }));

  return (
    <div>
      {/* Header */}
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-brand-700">
        <ArrowLeftIcon /> All lectures
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl text-ink sm:text-4xl">{lecture.title}</h1>
            <StatusPill status={status} />
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-500">
            <span className="inline-flex items-center gap-1.5">
              {lecture.sourceType === "pdf" ? <FileIcon /> : <TextIcon />}
              {lecture.sourceType === "pdf" ? (lecture.fileName ?? "PDF") : "Pasted text"}
            </span>
            {first && (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <SparklesIcon /> <span className="font-mono text-xs">{first.model}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ClockIcon /> {new Date(first.generatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="#delete" className="btn-secondary">
            <TrashIcon /> Delete
          </a>
          {quiz ? (
            <Link href={`/admin/quiz/${quiz._id}`} className="btn-primary">
              View published survey <ArrowRightIcon />
            </Link>
          ) : (
            <PublishButton lectureId={lectureId} disabled={active.length === 0} count={active.length} className="xl:hidden" />
          )}
        </div>
      </div>

      {/* Overview */}
      <section className="card mt-6 grid grid-cols-1 gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
        <dl className="grid grid-cols-3 gap-6">
          <Stat label="Active" value={active.length} tone="text-ink" />
          <Stat label="Removed" value={removedCount} tone={removedCount ? "text-rose-600" : "text-ink"} />
          <Stat label="To check" value={notVerbatim} tone={notVerbatim ? "text-amber-600" : "text-ink"} />
        </dl>
        <div className="md:border-l md:border-line md:pl-6">
          <p className="text-xs font-medium text-stone-500">Difficulty mix of active questions</p>
          <div className="mt-2 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-stone-100">
            {mix.map((d) =>
              d.n ? <span key={d.id} className={d.bar} style={{ width: `${(d.n / Math.max(1, active.length)) * 100}%` }} /> : null,
            )}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
            {mix.map((d) => (
              <li key={d.id} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${d.bar}`} /> {d.label} <span className="text-stone-400 tabular-nums">{d.n}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {locked ? (
        <div className="mt-4 flex items-start gap-3 rounded-lg border-2 border-line bg-stone-50 px-4 py-3 text-sm text-stone-600">
          <LockIcon className="mt-0.5 shrink-0 text-stone-400" />
          This set is published, so it&apos;s locked. Removals made before publishing are kept for the research record.
        </div>
      ) : (
        <ol className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          {[
            ["Read each question", "Check the answer key and the quoted excerpt."],
            ["Remove weak ones", "Give a reason. It's saved as research data."],
            ["Publish", "Students join with the QR code."],
          ].map(([t, d], i) => (
            <li key={t} className="flex items-start gap-2.5 rounded-lg border-2 border-line bg-surface px-3 py-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-semibold text-white">
                {i + 1}
              </span>
              <span>
                <span className="font-semibold text-ink">{t}</span>
                <span className="block text-xs text-stone-500">{d}</span>
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_240px] xl:items-start">
        {/* Questions */}
        <ol className="space-y-4">
          {questions.map((q, i) => {
            const removed = q.removedBeforeSurvey;
            return (
              <li
                key={String(q._id)}
                id={`q${i + 1}`}
                className={`card scroll-mt-20 ${removed ? "border-dashed bg-stone-50/80" : ""}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs font-semibold ${
                      removed ? "bg-rose-100 text-rose-700" : "bg-brand-600 text-white"
                    }`}
                  >
                    Q{i + 1}
                  </span>
                  <DifficultyPill level={q.difficulty} />
                  {!q.excerptFoundInText && (
                    <span className="pill bg-amber-50 text-amber-800" title="The excerpt was not found word for word in the notes">
                      <AlertIcon /> Excerpt not verbatim
                    </span>
                  )}
                  {removed && <span className="pill ml-auto bg-rose-50 text-rose-700">Removed</span>}
                </div>

                {removed && q.removalReason && (
                  <p className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
                    <TrashIcon className="mt-0.5 shrink-0" />
                    <span>
                      <span className="font-semibold">Removed:</span> {q.removalReason}
                    </span>
                  </p>
                )}

                <p className={`mt-3 text-base leading-relaxed font-semibold ${removed ? "text-stone-400 line-through" : "text-ink"}`}>
                  {q.question}
                </p>

                <ul className={`mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 ${removed ? "opacity-60" : ""}`}>
                  {q.options.map((opt, j) => {
                    const correct = j === q.correctIndex;
                    return (
                      <li
                        key={j}
                        className={`flex items-start gap-2.5 rounded-lg border-2 px-3 py-2.5 text-sm ${
                          correct ? "border-emerald-500 bg-emerald-50 text-emerald-950" : "border-line text-stone-700"
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                            correct ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-500"
                          }`}
                        >
                          {correct ? <CheckIcon strokeWidth={3.5} /> : LETTERS[j]}
                        </span>
                        <span className={correct ? "font-medium" : ""}>{opt}</span>
                        {correct && <span className="ml-auto shrink-0 text-[11px] font-semibold text-emerald-700">Answer</span>}
                      </li>
                    );
                  })}
                </ul>

                <div className={`mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2 ${removed ? "opacity-60" : ""}`}>
                  <div className="rounded-lg bg-stone-50 p-3.5">
                    <p className="text-xs font-semibold text-stone-500">Why it&apos;s correct</p>
                    <p className="mt-1 leading-relaxed text-stone-700">{q.explanation}</p>
                  </div>
                  <div className={`rounded-lg p-3.5 ${q.excerptFoundInText ? "bg-brand-50/70" : "bg-amber-50"}`}>
                    <p
                      className={`flex items-center gap-1.5 text-xs font-semibold ${q.excerptFoundInText ? "text-brand-700" : "text-amber-700"}`}
                    >
                      {q.excerptFoundInText ? <CheckIcon /> : <AlertIcon />}
                      {q.excerptFoundInText ? "Quoted from the notes" : "Quote not found in the notes"}
                    </p>
                    <blockquote
                      className={`mt-1.5 border-l-2 pl-3 leading-relaxed text-stone-700 italic ${
                        q.excerptFoundInText ? "border-brand-300" : "border-amber-300"
                      }`}
                    >
                      {q.sourceExcerpt}
                    </blockquote>
                  </div>
                </div>

                {!locked && <RemoveControls questionId={String(q._id)} removed={removed} />}
              </li>
            );
          })}
        </ol>

        {/* Side panel: question navigator + publish (wide screens) */}
        <aside className="card hidden p-4 xl:sticky xl:top-6 xl:block">
          <p className="text-xs font-semibold text-stone-500">Jump to question</p>
          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {questions.map((q, i) => {
              const tone = q.removedBeforeSurvey
                ? "bg-rose-50 text-rose-600 line-through"
                : !q.excerptFoundInText
                  ? "bg-amber-100 text-amber-800"
                  : "bg-stone-100 text-stone-700";
              return (
                <a
                  key={String(q._id)}
                  href={`#q${i + 1}`}
                  title={q.question}
                  className={`flex h-8 items-center justify-center rounded-md text-xs font-semibold tabular-nums transition hover:ring-2 hover:ring-brand-400 ${tone}`}
                >
                  {i + 1}
                </a>
              );
            })}
          </div>
          <ul className="mt-3 space-y-1 text-[11px] text-stone-500">
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-stone-200" /> Active
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-200" /> Excerpt to check
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-rose-200" /> Removed
            </li>
          </ul>
          {!quiz && (
            <div className="mt-4 border-t border-line pt-4">
              <PublishButton lectureId={lectureId} disabled={active.length === 0} count={active.length} className="w-full" short />
              <p className="mt-2 text-center text-[11px] text-stone-500">Locks the set and opens the survey.</p>
            </div>
          )}
        </aside>
      </div>

      <DeleteLecture lectureId={lectureId} title={lecture.title} counts={{ questions: questions.length, students, reviews }} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-stone-500">{label}</dt>
      <dd className={`mt-0.5 font-display font-bold text-3xl tabular-nums ${tone}`}>{value}</dd>
    </div>
  );
}
