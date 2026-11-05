import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { connectDB } from "@/lib/db";
import { Lecture, Participant, Question, Quiz } from "@/lib/models";

export default function AdminHome() {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Lectures</h1>
          <p className="mt-1 text-sm text-stone-500">Generated question sets and their published surveys.</p>
        </div>
        <Link href="/admin/generate" className="btn-primary">
          + Generate questions
        </Link>
      </div>
      <Suspense fallback={<p className="mt-8 text-stone-500">Loading…</p>}>
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
      <div className="card mt-8 text-center text-stone-600">
        No lectures yet. <Link href="/admin/generate" className="underline">Generate your first question set</Link>, or run{" "}
        <code className="rounded bg-stone-100 px-1.5 py-0.5 text-sm">npm run seed</code>.
      </div>
    );
  }

  const quizByLecture = new Map(quizzes.map((q) => [String(q.lectureId), q]));
  const countByLecture = new Map(counts.map((c) => [String(c._id), c]));
  const partByQuiz = new Map(participantCounts.map((p) => [String(p._id), p]));

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-stone-200 bg-white">
      <ul className="divide-y divide-stone-200">
        {lectures.map((l) => {
          const id = String(l._id);
          const quiz = quizByLecture.get(id);
          const c = countByLecture.get(id);
          const p = quiz ? partByQuiz.get(String(quiz._id)) : undefined;
          return (
            <li key={id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <Link href={`/admin/lectures/${id}`} className="font-medium text-stone-900 hover:underline">
                  {l.title}
                </Link>
                <p className="mt-0.5 text-sm text-stone-500">
                  {(c?.total ?? 0) - (c?.removed ?? 0)} active questions
                  {c?.removed ? ` · ${c.removed} removed` : ""} · {l.sourceType === "pdf" ? (l.fileName ?? "PDF") : "pasted text"} ·{" "}
                  {new Date(l.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {quiz ? (
                  <>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        quiz.isOpen ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-600"
                      }`}
                    >
                      {quiz.isOpen ? "Open" : "Closed"}
                    </span>
                    <span className="text-sm text-stone-500">
                      {p?.completed ?? 0}/{p?.started ?? 0} completed
                    </span>
                    <Link href={`/admin/quiz/${quiz._id}`} className="btn-secondary">
                      Survey
                    </Link>
                  </>
                ) : (
                  <Link href={`/admin/lectures/${id}`} className="btn-secondary">
                    Review &amp; publish
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
