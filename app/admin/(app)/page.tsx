import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { IconTile, LoadingCard, PageHeader, StatCard, StatusPill } from "@/components/admin-ui";
import { ArrowRightIcon, ChartIcon, CheckIcon, FileIcon, PlusIcon, SparklesIcon, UsersIcon } from "@/components/icons";
import { connectDB } from "@/lib/db";
import { Lecture, Participant, Question, Quiz } from "@/lib/models";

export default function AdminHome() {
  return (
    <div>
      <PageHeader
        title="Lectures"
        subtitle="Generated question sets and their published surveys."
        actions={
          <Link href="/admin/generate" className="btn-primary">
            <PlusIcon /> Generate questions
          </Link>
        }
      />
      <Suspense fallback={<LoadingCard />}>
        <LectureList />
      </Suspense>
    </div>
  );
}

async function LectureList() {
  await connection(); // always read fresh data at request time
  await connectDB();
  const [lectures, quizzes, counts, participantCounts] = await Promise.all([
    Lecture.find({}, { text: 0 }).sort({ createdAt: -1 }).lean(),
    Quiz.find().lean(),
    Question.aggregate<{ _id: unknown; total: number; removed: number }>([
      { $group: { _id: "$lectureId", total: { $sum: 1 }, removed: { $sum: { $cond: ["$removedBeforeSurvey", 1, 0] } } } },
    ]),
    Participant.aggregate<{ _id: unknown; started: number; completed: number }>([
      {
        $group: {
          _id: "$quizId",
          started: { $sum: 1 },
          completed: { $sum: { $cond: [{ $ifNull: ["$completedAt", false] }, 1, 0] } },
        },
      },
    ]),
  ]);

  if (lectures.length === 0) {
    return (
      <div className="card mt-8 flex flex-col items-center py-14 text-center">
        <IconTile icon={<SparklesIcon />} />
        <h2 className="mt-4 text-lg font-semibold">No lectures yet</h2>
        <p className="mt-1 max-w-sm text-sm text-stone-500">
          Generate your first question set from lecture notes, or run{" "}
          <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">npm run seed</code> for sample data.
        </p>
        <Link href="/admin/generate" className="btn-primary mt-5">
          <PlusIcon /> Generate questions
        </Link>
      </div>
    );
  }

  const quizByLecture = new Map(quizzes.map((q) => [String(q.lectureId), q]));
  const countByLecture = new Map(counts.map((c) => [String(c._id), c]));
  const partByQuiz = new Map(participantCounts.map((p) => [String(p._id), p]));
  const totalStarted = participantCounts.reduce((s, p) => s + p.started, 0);
  const totalCompleted = participantCounts.reduce((s, p) => s + p.completed, 0);
  const openCount = quizzes.filter((q) => q.isOpen).length;

  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Lectures" value={lectures.length} icon={<FileIcon />} tone="brand" />
        <StatCard label="Open surveys" value={openCount} hint={`${quizzes.length} published`} icon={<ChartIcon />} tone="emerald" />
        <StatCard label="Participants" value={totalStarted} hint="started a survey" icon={<UsersIcon />} tone="violet" />
        <StatCard label="Completed" value={totalCompleted} hint="submitted final survey" icon={<CheckIcon />} tone="amber" />
      </div>

      <h2 className="mt-10 mb-3 text-sm font-semibold tracking-wide text-stone-500 uppercase">All question sets</h2>
      <ul className="space-y-3">
        {lectures.map((l) => {
          const id = String(l._id);
          const quiz = quizByLecture.get(id);
          const c = countByLecture.get(id);
          const p = quiz ? partByQuiz.get(String(quiz._id)) : undefined;
          const status = !quiz ? "draft" : quiz.isOpen ? "open" : "closed";
          const href = quiz ? `/admin/quiz/${quiz._id}` : `/admin/lectures/${id}`;
          return (
            <li key={id}>
              <Link
                href={href}
                className="card group flex flex-wrap items-center gap-4 transition hover:-translate-x-px hover:-translate-y-px hover:bg-yellow-50 hover:shadow-lg sm:flex-nowrap"
              >
                <IconTile icon={<FileIcon />} tone={status === "open" ? "emerald" : status === "draft" ? "amber" : "brand"} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold text-stone-900">{l.title}</span>
                    <StatusPill status={status} />
                  </div>
                  <p className="mt-1 text-sm text-stone-500">
                    {(c?.total ?? 0) - (c?.removed ?? 0)} questions
                    {c?.removed ? <span className="text-rose-600"> · {c.removed} removed</span> : null} ·{" "}
                    {l.sourceType === "pdf" ? (l.fileName ?? "PDF") : "pasted text"} · {new Date(l.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {quiz ? (
                  <div className="text-right">
                    <p className="text-lg font-semibold text-stone-900 tabular-nums">
                      {p?.completed ?? 0}
                      <span className="text-sm font-normal text-stone-400"> / {p?.started ?? 0}</span>
                    </p>
                    <p className="text-xs text-stone-500">completed</p>
                  </div>
                ) : (
                  <span className="text-sm font-medium text-amber-700">Review &amp; publish</span>
                )}
                <ArrowRightIcon className="hidden text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500 sm:block" />
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
