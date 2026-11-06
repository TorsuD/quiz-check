import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { isValidObjectId } from "mongoose";
import {
  DifficultyPill,
  LoadingCard,
  PageHeader,
  StatusPill,
} from "@/components/admin-ui";
import {
  AlertIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  LockIcon,
  TrashIcon,
} from "@/components/icons";
import { LETTERS } from "@/lib/constants";
import { connectDB } from "@/lib/db";
import {
  ExpertReview,
  Lecture,
  Participant,
  Question,
  Quiz,
} from "@/lib/models";
import {
  DeleteLecture,
  PublishButton,
  RemoveControls,
} from "./LectureControls";

export default function LecturePage({
  params,
}: PageProps<"/admin/lectures/[lectureId]">) {
  return (
    <Suspense fallback={<LoadingCard />}>
      <LectureDetail params={params} />
    </Suspense>
  );
}

async function LectureDetail({
  params,
}: {
  params: Promise<{ lectureId: string }>;
}) {
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
    ? await Promise.all([
        Participant.countDocuments({ quizId: quiz._id }),
        ExpertReview.countDocuments({ quizId: quiz._id }),
      ])
    : [0, 0];

  const active = questions.filter((q) => !q.removedBeforeSurvey);
  const locked = Boolean(quiz);
  const first = questions[0];
  const notVerbatim = active.filter((q) => !q.excerptFoundInText).length;

  return (
    <div>
      <PageHeader
        eyebrow={
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-stone-500 hover:text-brand-700"
          >
            <ArrowLeftIcon /> All lectures
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {lecture.title}{" "}
            <StatusPill
              status={!quiz ? "draft" : quiz.isOpen ? "open" : "closed"}
            />
          </span>
        }
        subtitle={
          <>
            <span className="font-medium text-stone-700">
              {active.length} active
            </span>
            {questions.length - active.length > 0 && (
              <span className="text-rose-600">
                {" "}
                · {questions.length - active.length} removed
              </span>
            )}
            {first && (
              <>
                {" "}
                · <span className="font-mono text-xs">
                  {first.model}
                </span> · {new Date(first.generatedAt).toLocaleString()}
              </>
            )}
          </>
        }
        actions={
          <div className="flex flex-wrap items-start gap-2">
            <a href="#delete" className="btn-secondary">
              <TrashIcon /> Delete
            </a>
            {quiz ? (
              <Link href={`/admin/quiz/${quiz._id}`} className="btn-primary">
                View published survey <ArrowRightIcon />
              </Link>
            ) : (
              <PublishButton
                lectureId={lectureId}
                disabled={active.length === 0}
                count={active.length}
              />
            )}
          </div>
        }
      />

      {locked ? (
        <div className="mt-6 flex items-start gap-3 rounded-md border-2 border-line bg-field px-4 py-3 text-sm text-stone-600">
          <LockIcon className="mt-0.5 shrink-0 text-stone-400" />
          This set has been published, so it is locked. Removals made before
          publishing are kept for the research record.
        </div>
      ) : (
        <div className="mt-6 flex items-start gap-3 rounded-md border-2 border-line bg-brand-50/60 px-4 py-3 text-sm text-brand-900">
          <CheckIcon className="mt-0.5 shrink-0 text-brand-500" />
          <span>
            Review each question before publishing. Removed questions stay in
            the database with your reason, because removals are research data.
            {notVerbatim > 0 && (
              <span className="mt-1 block text-amber-800">
                {notVerbatim} question
                {notVerbatim === 1 ? " has an excerpt" : "s have excerpts"} not
                found word for word in the notes. Check
                {notVerbatim === 1 ? " it" : " them"} closely.
              </span>
            )}
          </span>
        </div>
      )}

      <ol className="mt-6 space-y-4">
        {questions.map((q, i) => {
          const removed = q.removedBeforeSurvey;
          return (
            <li
              key={String(q._id)}
              className={`card ${removed ? "border-dashed border-rose-200 bg-rose-50/30" : ""}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-xs font-bold ${
                    removed
                      ? "bg-rose-100 text-rose-700"
                      : "bg-brand-50 text-brand-700"
                  }`}
                >
                  Q{i + 1}
                </span>
                <DifficultyPill level={q.difficulty} />
                {!q.excerptFoundInText && (
                  <span
                    className="pill bg-amber-50 text-amber-800"
                    title="The excerpt was not found word for word in the notes"
                  >
                    <AlertIcon /> excerpt not verbatim
                  </span>
                )}
                {removed && (
                  <span className="pill bg-rose-100 text-rose-700">
                    Removed
                  </span>
                )}
              </div>
              <p
                className={`mt-3 text-[15px] leading-relaxed font-semibold text-stone-900 ${removed ? "text-stone-500 line-through" : ""}`}
              >
                {q.question}
              </p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {q.options.map((opt, j) => {
                  const correct = j === q.correctIndex;
                  return (
                    <li
                      key={j}
                      className={`flex items-start gap-2.5 rounded-xl border px-3 py-2 text-sm ${
                        correct
                          ? "border-line bg-emerald-100 text-emerald-950"
                          : "border-stone-200 text-stone-700"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${
                          correct
                            ? "bg-emerald-600 text-white"
                            : "bg-stone-100 text-stone-500"
                        }`}
                      >
                        {correct ? <CheckIcon strokeWidth={3.5} /> : LETTERS[j]}
                      </span>
                      <span className={correct ? "font-medium" : ""}>
                        {opt}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded-xl bg-stone-50 p-3.5">
                  <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
                    Explanation
                  </p>
                  <p className="mt-1 leading-relaxed text-stone-700">
                    {q.explanation}
                  </p>
                </div>
                <div
                  className={`rounded-xl p-3.5 ${q.excerptFoundInText ? "bg-brand-50/60" : "bg-amber-50"}`}
                >
                  <p
                    className={`text-xs font-semibold tracking-wide uppercase ${q.excerptFoundInText ? "text-brand-600" : "text-amber-700"}`}
                  >
                    Source excerpt
                  </p>
                  <blockquote
                    className={`mt-1 border-l-2 pl-3 leading-relaxed text-stone-700 italic ${q.excerptFoundInText ? "border-brand-300" : "border-amber-300"}`}
                  >
                    {q.sourceExcerpt}
                  </blockquote>
                </div>
              </div>
              {removed && q.removalReason && (
                <p className="mt-3 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
                  <span className="font-semibold">Removal reason:</span>{" "}
                  {q.removalReason}
                </p>
              )}
              {!locked && (
                <RemoveControls questionId={String(q._id)} removed={removed} />
              )}
            </li>
          );
        })}
      </ol>

      <DeleteLecture
        lectureId={lectureId}
        title={lecture.title}
        counts={{ questions: questions.length, students, reviews }}
      />
    </div>
  );
}
