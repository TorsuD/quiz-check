import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { isValidObjectId } from "mongoose";
import { REVIEWERS, isReviewerId, reviewerName } from "@/config/reviewers";
import { DifficultyPill, LoadingCard, PageHeader } from "@/components/admin-ui";
import { AlertIcon, ArrowLeftIcon, ChartIcon, CheckIcon, FileIcon, ShieldIcon, UsersIcon } from "@/components/icons";
import { connectDB } from "@/lib/db";
import { LETTERS } from "@/lib/constants";
import { ExpertReview, Lecture, Question, Quiz } from "@/lib/models";
import ReviewForm from "./ReviewForm";

export default function ExpertReviewPage({ params, searchParams }: PageProps<"/admin/review/[quizId]">) {
  return (
    <Suspense fallback={<LoadingCard />}>
      <ExpertReviewContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ExpertReviewContent({
  params,
  searchParams,
}: {
  params: Promise<{ quizId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection(); // database reads must happen at request time, not during prerendering
  const [{ quizId }, sp] = await Promise.all([params, searchParams]);
  const reviewer = typeof sp.reviewer === "string" && isReviewerId(sp.reviewer) ? sp.reviewer : null;

  if (!isValidObjectId(quizId)) return <p>Survey not found.</p>;
  await connectDB();
  const quiz = await Quiz.findById(quizId).lean();
  if (!quiz) return <p>Survey not found.</p>;

  const [lecture, questions, reviews] = await Promise.all([
    Lecture.findById(quiz.lectureId, { title: 1, text: 1 }).lean(),
    Question.find({ lectureId: quiz.lectureId }).sort({ order: 1 }).lean(),
    ExpertReview.find({ quizId }).lean(),
  ]);
  const surveyPos = new Map(quiz.questionIds.map((id, i) => [String(id), i + 1]));
  const doneBy = (id: string) => new Set(reviews.filter((r) => r.reviewer === id).map((r) => String(r.questionId)));

  const header = (
    <PageHeader
      eyebrow={
        <Link href={`/admin/quiz/${quizId}`} className="inline-flex items-center gap-1.5 text-stone-500 hover:text-brand-700">
          <ArrowLeftIcon /> Survey
        </Link>
      }
      title="Expert review"
      subtitle={quiz.title}
      actions={
        <Link href={`/admin/results/${quizId}`} className="btn-secondary">
          <ChartIcon /> Results
        </Link>
      }
    />
  );

  // ---------- Choose who is reviewing ----------
  if (!reviewer) {
    return (
      <div>
        {header}
        <div className="card mt-6">
          <h2 className="font-semibold">Who is reviewing?</h2>
          <p className="mt-1 text-sm text-stone-600">
            Each reviewer scores every question on their own. Your scores are saved under your name and the other
            reviewer&apos;s scores are not shown here, so the two reviews stay independent.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {REVIEWERS.map((r) => {
              const done = doneBy(r.id).size;
              return (
                <Link
                  key={r.id}
                  href={`/admin/review/${quizId}?reviewer=${r.id}`}
                  className="group flex items-center gap-4 rounded-md border-2 border-line bg-field p-4 shadow-xs transition hover:-translate-x-px hover:-translate-y-px hover:bg-yellow-50 hover:shadow-sm"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border-2 border-line bg-yellow-300 font-display text-lg text-ink">
                    {r.id}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">{r.name}</span>
                    <span className="block text-xs text-stone-500">
                      {done} of {questions.length} questions scored
                    </span>
                    <span className="mt-2 block h-1.5 overflow-hidden rounded-xs bg-stone-200">
                      <span
                        className="block h-full bg-emerald-500"
                        style={{ width: `${questions.length ? (done / questions.length) * 100 : 0}%` }}
                      />
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-stone-500">
            Reviewer names are set in <code className="font-mono">config/reviewers.ts</code>.
          </p>
        </div>
      </div>
    );
  }

  // ---------- Review form for one reviewer ----------
  const mine = new Map(reviews.filter((r) => r.reviewer === reviewer).map((r) => [String(r.questionId), r]));
  const done = mine.size;
  const progress = questions.length ? (done / questions.length) * 100 : 0;

  return (
    <div>
      {header}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="text-sm text-stone-600">Reviewing as</span>
        <div className="segmented" role="tablist" aria-label="Reviewer">
          {REVIEWERS.map((r) => (
            <Link
              key={r.id}
              href={`/admin/review/${quizId}?reviewer=${r.id}`}
              role="tab"
              aria-selected={r.id === reviewer}
              className={r.id === reviewer ? "segment-active" : "segment"}
            >
              {r.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="card">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-ink">
              {done} of {questions.length} scored by {reviewerName(reviewer)}
            </p>
            {done === questions.length && questions.length > 0 && (
              <span className="pill text-emerald-700">
                <CheckIcon /> Complete
              </span>
            )}
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-sm border-2 border-line bg-field">
            <div className="stripes h-full bg-emerald-500" style={{ width: `${progress}%` }} />
          </div>
          <ul className="mt-4 space-y-1.5 text-xs text-stone-600">
            <li className="flex gap-2">
              <ShieldIcon className="mt-0.5 shrink-0 text-brand-600" /> Judge each question against the lecture notes, not
              general knowledge.
            </li>
            <li className="flex gap-2">
              <UsersIcon className="mt-0.5 shrink-0 text-brand-600" /> Score on your own; don&apos;t discuss with the other
              reviewer until both of you have finished.
            </li>
            <li className="flex gap-2">
              <AlertIcon className="mt-0.5 shrink-0 text-brand-600" /> Removed questions are included on purpose: accuracy is
              measured on everything the AI produced.
            </li>
          </ul>
        </div>

        <details className="card group h-fit">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
            <FileIcon /> Lecture notes
            <span className="ml-auto text-xs font-normal text-stone-500 group-open:hidden">Show</span>
            <span className="ml-auto hidden text-xs font-normal text-stone-500 group-open:inline">Hide</span>
          </summary>
          <p className="mt-3 max-h-96 overflow-y-auto text-xs leading-relaxed whitespace-pre-wrap text-stone-700">
            {lecture?.text ?? "Notes not found."}
          </p>
        </details>
      </div>

      <ol className="mt-6 space-y-5">
        {questions.map((q, i) => {
          const id = String(q._id);
          const survey = surveyPos.get(id);
          const existing = mine.get(id);
          return (
            <li key={id} id={`q-${id}`} className="card scroll-mt-20">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-sm border-2 border-line bg-yellow-300 text-xs font-semibold text-ink">
                  {i + 1}
                </span>
                {survey ? (
                  <span className="pill text-brand-700">Survey Q{survey}</span>
                ) : (
                  <span className="pill text-rose-700">Removed before survey</span>
                )}
                <DifficultyPill level={q.difficulty} />
                {!q.excerptFoundInText && (
                  <span className="pill text-amber-800" title="The quoted excerpt was not found word for word in the notes">
                    <AlertIcon /> Excerpt not verbatim
                  </span>
                )}
              </div>

              <h2 className="mt-3 font-sans text-base leading-relaxed font-semibold tracking-normal text-ink">{q.question}</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {q.options.map((opt, oi) => {
                  const correct = oi === q.correctIndex;
                  return (
                    <li
                      key={oi}
                      className={`flex gap-2.5 rounded-md border-2 px-3 py-2 text-sm ${
                        correct ? "border-line bg-emerald-100 text-emerald-950" : "border-stone-200 text-stone-700"
                      }`}
                    >
                      <span className="font-semibold">{LETTERS[oi]}</span>
                      <span className="flex-1">{opt}</span>
                      {correct && (
                        <span className="flex items-center gap-1 text-xs font-semibold">
                          <CheckIcon /> Key
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>

              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-md border-2 border-dashed border-stone-300 p-3">
                  <p className="label">AI explanation</p>
                  <p className="text-stone-700">{q.explanation}</p>
                </div>
                <div
                  className={`rounded-md border-2 p-3 ${q.excerptFoundInText ? "border-dashed border-stone-300" : "border-line bg-yellow-100"}`}
                >
                  <p className="label">Source excerpt it cites</p>
                  <p className="text-stone-700 italic">&ldquo;{q.sourceExcerpt}&rdquo;</p>
                </div>
              </div>
              {q.removedBeforeSurvey && q.removalReason && (
                <p className="mt-3 text-xs text-rose-700">Removed by researcher: {q.removalReason}</p>
              )}

              <ReviewForm
                quizId={quizId}
                questionId={id}
                reviewer={reviewer}
                initial={
                  existing
                    ? {
                        factuallyCorrect: existing.factuallyCorrect,
                        answerKeyCorrect: existing.answerKeyCorrect,
                        relevance: existing.relevance,
                        clarity: existing.clarity,
                        errorTags: existing.errorTags,
                        otherNote: existing.otherNote,
                        savedAt: existing.updatedAt.toISOString(),
                      }
                    : null
                }
              />
            </li>
          );
        })}
      </ol>

      {done === questions.length && questions.length > 0 && (
        <div className="card mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-stone-700">All questions scored. See how the two reviews compare.</p>
          <Link href={`/admin/results/${quizId}`} className="btn-primary">
            <ChartIcon /> View results
          </Link>
        </div>
      )}
    </div>
  );
}
