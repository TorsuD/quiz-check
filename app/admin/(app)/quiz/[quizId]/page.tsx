import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { LoadingCard, PageHeader } from "@/components/admin-ui";
import { ArrowLeftIcon, ChartIcon, DownloadIcon, QrIcon, ShieldIcon } from "@/components/icons";
import { loadQuizBundle } from "@/lib/quiz";
import { Participant, QuestionResponse, SurveyResponse } from "@/lib/models";
import { quizUrlAndQr } from "@/lib/url";
import { CopyLink, OpenToggle } from "./QuizControls";

export default function QuizAdminPage({ params }: PageProps<"/admin/quiz/[quizId]">) {
  return (
    <Suspense fallback={<LoadingCard />}>
      <QuizAdmin params={params} />
    </Suspense>
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
  const rate = started ? Math.round((completed / started) * 100) : 0;

  return (
    <div>
      <PageHeader
        eyebrow={
          <Link href={`/admin/lectures/${quiz.lectureId}`} className="inline-flex items-center gap-1.5 text-stone-500 hover:text-brand-700">
            <ArrowLeftIcon /> Question set
          </Link>
        }
        title={quiz.title}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-x-2">
            <span className="inline-flex items-center gap-1.5 font-medium text-stone-700">
              <span className={`h-2 w-2 rounded-full ${quiz.isOpen ? "animate-pulse bg-emerald-500" : "bg-stone-400"}`} />
              {quiz.isOpen ? "Open" : "Closed"}
            </span>
            <span>· {questions.length} questions</span>
            <span>· published {new Date(quiz.publishedAt).toLocaleDateString()}</span>
          </span>
        }
        actions={<OpenToggle quizId={quizId} isOpen={quiz.isOpen} />}
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-8">
          {/* Responses at a glance */}
          <section>
            <dl className="grid grid-cols-3 divide-x-2 divide-line rounded-md border-2 border-line bg-surface">
              <Stat label="Started" value={started} />
              <Stat label="Completed" value={completed} />
              <Stat label="Completion" value={started ? `${rate}%` : "–"} />
            </dl>
          </section>

          {/* Next steps */}
          <nav className="flex flex-wrap gap-2" aria-label="Analysis">
            <Link href={`/admin/review/${quizId}`} className="btn-secondary">
              <ShieldIcon /> Expert review
            </Link>
            <Link href={`/admin/results/${quizId}`} className="btn-secondary">
              <ChartIcon /> Results
            </Link>
          </nav>

          <section id="export" className="scroll-mt-20">
            <h2 className="label">Export</h2>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <a href={`/api/admin/quizzes/${quizId}/export/responses`} className="inline-flex items-center gap-1.5 font-semibold text-ink hover:text-brand-700">
                <DownloadIcon /> Responses CSV <span className="font-normal text-stone-500">({responses})</span>
              </a>
              <a href={`/api/admin/quizzes/${quizId}/export/survey`} className="inline-flex items-center gap-1.5 font-semibold text-ink hover:text-brand-700">
                <DownloadIcon /> Survey CSV <span className="font-normal text-stone-500">({surveys})</span>
              </a>
            </div>
          </section>

          <details className="group">
            <summary className="label cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              Questions ({questions.length}) <span className="inline-block transition group-open:rotate-90">›</span>
            </summary>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-stone-700 marker:text-stone-400">
              {questions.map((q) => (
                <li key={String(q._id)}>{q.question}</li>
              ))}
            </ol>
          </details>
        </div>

        <aside className="h-fit text-center">
          <div className="rounded-md border-2 border-line bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt={`QR code for ${url}`} className="mx-auto w-full max-w-56" />
          </div>
          <CopyLink url={url} />
          <Link href={`/admin/present/${quizId}`} target="_blank" className="btn-primary mt-2 w-full">
            <QrIcon /> Present QR
          </Link>
          {!quiz.isOpen && <p className="mt-3 text-xs text-stone-500">Closed: new students can&apos;t start.</p>}
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="px-4 py-3">
      <dt className="text-[11px] font-semibold tracking-wider text-stone-500 uppercase">{label}</dt>
      <dd className="mt-0.5 font-display text-2xl text-ink tabular-nums">{value}</dd>
    </div>
  );
}
