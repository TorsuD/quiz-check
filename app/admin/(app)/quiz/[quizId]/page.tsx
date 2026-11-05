import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { loadQuizBundle } from "@/lib/quiz";
import { Participant, QuestionResponse, SurveyResponse } from "@/lib/models";
import { quizUrlAndQr } from "@/lib/url";
import { CopyLink, OpenToggle } from "./QuizControls";

export default function QuizAdminPage({ params }: PageProps<"/admin/quiz/[quizId]">) {
  return (
    <Suspense fallback={<p className="text-stone-500">Loading…</p>}>
      <QuizAdmin params={params} />
    </Suspense>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="card">
      <p className="text-sm text-stone-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

async function QuizAdmin({ params }: { params: Promise<{ quizId: string }> }) {
  await connection(); // database reads must happen at request time, not during prerendering
  const { quizId } = await params;
  const bundle = await loadQuizBundle(quizId);
  if (!bundle) return <p>Quiz not found.</p>;
  const { quiz, questions } = bundle;

  const [started, completed, responses, surveys, { url, qr }] = await Promise.all([
    Participant.countDocuments({ quizId }),
    Participant.countDocuments({ quizId, completedAt: { $ne: null } }),
    QuestionResponse.countDocuments({ quizId }),
    SurveyResponse.countDocuments({ quizId }),
    quizUrlAndQr(quizId),
  ]);

  return (
    <div>
      <Link href={`/admin/lectures/${quiz.lectureId}`} className="text-sm text-stone-500 hover:underline">
        ← Question set
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{quiz.title}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {questions.length} questions · published {new Date(quiz.publishedAt).toLocaleString()}
          </p>
        </div>
        <OpenToggle quizId={quizId} isOpen={quiz.isOpen} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Started" value={started} hint="Agreed to consent" />
            <Stat label="Completed" value={completed} hint="Submitted final survey" />
            <Stat label="Completion rate" value={started ? `${Math.round((completed / started) * 100)}%` : "–"} />
          </div>

          <div className="card">
            <h2 className="font-semibold">Export data</h2>
            <p className="mt-1 text-sm text-stone-500">
              {responses} question responses · {surveys} final surveys. Partial responses are included.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href={`/api/admin/quizzes/${quizId}/export/responses`} className="btn-secondary">
                Download responses CSV
              </a>
              <a href={`/api/admin/quizzes/${quizId}/export/survey`} className="btn-secondary">
                Download survey CSV
              </a>
            </div>
            <p className="mt-3 text-xs text-stone-500">
              Responses CSV: one row per participant per question (blank if not answered). Survey CSV: one row per
              participant who submitted the final survey.
            </p>
          </div>

          <div className="card">
            <h2 className="font-semibold">Questions in this survey</h2>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-stone-700">
              {questions.map((q) => (
                <li key={String(q._id)}>{q.question}</li>
              ))}
            </ol>
          </div>
        </div>

        <aside className="card h-fit text-center">
          <h2 className="font-semibold">Student link</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`QR code for ${url}`} className="mx-auto mt-3 w-full max-w-64" />
          <CopyLink url={url} />
          <Link href={`/admin/present/${quizId}`} target="_blank" className="btn-primary mt-3 w-full">
            Open full-screen QR for slides
          </Link>
          {!quiz.isOpen && <p className="mt-3 text-xs text-amber-700">The survey is closed: new students cannot start.</p>}
        </aside>
      </div>
    </div>
  );
}
