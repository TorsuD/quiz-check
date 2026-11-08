import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { IconTile, LoadingCard, PageHeader, type SurveyStatus } from "@/components/admin-ui";
import {
  ArrowRightIcon,
  ChartIcon,
  ClockIcon,
  FileIcon,
  PlusIcon,
  QrIcon,
  SearchIcon,
  ShieldIcon,
  SparklesIcon,
  TextIcon,
} from "@/components/icons";
import { REVIEWERS } from "@/config/reviewers";
import { connectDB } from "@/lib/db";
import { ExpertReview, Lecture, Participant, Question, Quiz } from "@/lib/models";

/** Lectures are shown in these groups, in this order; empty groups are hidden. */
const GROUPS: { status: SurveyStatus; title: string; hint: string }[] = [
  { status: "draft", title: "Needs review", hint: "Review the questions, then publish the survey." },
  { status: "open", title: "Live", hint: "Students can join now." },
  { status: "closed", title: "Closed", hint: "No longer accepting responses." },
];

export default function AdminHome({ searchParams }: PageProps<"/admin">) {
  return (
    <div className="relative isolate">
      <PageHeader
        title="Lectures"
        subtitle="Your question sets, from first draft to published survey and results."
        actions={
          <Link href="/admin/generate" className="btn-primary">
            <PlusIcon /> New question set
          </Link>
        }
      />
      <Suspense fallback={<LoadingCard />}>
        <LectureList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/** "Today", "yesterday", "5 days ago", or a date for anything older than a month. Runs at request time. */
function relativeDate(date: Date) {
  const days = Math.round((new Date(date).getTime() - Date.now()) / 86_400_000);
  if (days === 0) return "Today";
  if (Math.abs(days) < 30) return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(days, "day");
  return new Date(date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

async function LectureList({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  await connection(); // always read fresh data at request time
  const sp = await searchParams;
  const query = typeof sp.q === "string" ? sp.q.trim() : "";

  await connectDB();
  const [lectures, quizzes, counts, participantCounts, reviewCounts] = await Promise.all([
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
    ExpertReview.aggregate<{ _id: unknown; n: number }>([{ $group: { _id: "$quizId", n: { $sum: 1 } } }]),
  ]);

  if (lectures.length === 0) {
    return (
      <div className="card mt-8 flex flex-col items-center py-16 text-center">
        <IconTile icon={<SparklesIcon />} />
        <h2 className="mt-4 text-xl">Create your first question set</h2>
        <p className="mt-1.5 max-w-md text-sm text-stone-500">
          Upload lecture notes and let the AI draft multiple-choice questions, or import questions as JSON. Or run{" "}
          <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">npm run seed</code> for sample data.
        </p>
        <Link href="/admin/generate" className="btn-primary mt-6">
          <PlusIcon /> New question set
        </Link>
      </div>
    );
  }

  const quizByLecture = new Map(quizzes.map((q) => [String(q.lectureId), q]));
  const countByLecture = new Map(counts.map((c) => [String(c._id), c]));
  const partByQuiz = new Map(participantCounts.map((p) => [String(p._id), p]));
  const reviewsByQuiz = new Map(reviewCounts.map((r) => [String(r._id), r.n]));

  const rows = lectures.map((l) => {
    const id = String(l._id);
    const quiz = quizByLecture.get(id);
    const c = countByLecture.get(id);
    const total = c?.total ?? 0;
    const removed = c?.removed ?? 0;
    const p = quiz ? partByQuiz.get(String(quiz._id)) : undefined;
    const status: SurveyStatus = !quiz ? "draft" : quiz.isOpen ? "open" : "closed";
    return {
      id,
      title: l.title,
      status,
      quizId: quiz ? String(quiz._id) : null,
      active: total - removed,
      removed,
      source: l.sourceType === "pdf" ? (l.fileName ?? "PDF") : "Pasted text",
      sourceType: l.sourceType,
      created: relativeDate(l.createdAt),
      started: p?.started ?? 0,
      completed: p?.completed ?? 0,
      // Expert reviews cover every generated question, including removed ones.
      reviewed: quiz ? (reviewsByQuiz.get(String(quiz._id)) ?? 0) : 0,
      reviewTarget: total * REVIEWERS.length,
    };
  });

  const tally = {
    draft: rows.filter((r) => r.status === "draft").length,
    open: rows.filter((r) => r.status === "open").length,
  };
  const shown = rows.filter((r) => !query || r.title.toLowerCase().includes(query.toLowerCase()));

  const started = rows.reduce((s, r) => s + r.started, 0);
  const completed = rows.reduce((s, r) => s + r.completed, 0);
  const rate = started ? Math.round((completed / started) * 100) : null;

  return (
    <>
      {/* Overview */}
      <dl className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Overview label="Question sets" value={rows.length} hint={`${tally.draft} draft · ${quizzes.length} published`} />
        <Overview
          label="Live surveys"
          value={tally.open}
          hint={tally.open ? "accepting responses" : "none open"}
          live={tally.open > 0}
        />
        <Overview label="Participants" value={started} hint={`${completed} completed`} />
        <Overview label="Completion rate" value={rate === null ? "–" : `${rate}%`} bar={rate} />
      </dl>

      {/* Search */}
      <form action="/admin" className="relative mt-8 w-full sm:ml-auto sm:w-72">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-stone-400" />
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search lectures"
          aria-label="Search lectures by title"
          className="input py-2 pl-9 text-sm"
        />
      </form>

      {shown.length === 0 ? (
        <div className="card mt-4 py-12 text-center text-sm text-stone-500">
          No question sets match “{query}”.{" "}
          <Link href="/admin" className="font-semibold text-ink underline">
            Clear search
          </Link>
        </div>
      ) : (
        <div className="mt-2 space-y-8">
          {GROUPS.map((g) => {
            const items = shown.filter((r) => r.status === g.status);
            if (items.length === 0) return null;
            return (
              <section key={g.status} aria-labelledby={`group-${g.status}`}>
                <div className="mb-3 flex items-baseline gap-2">
                  <h2 id={`group-${g.status}`} className="text-lg text-ink">
                    {g.title}
                  </h2>
                  <span className="rounded-full bg-stone-100 px-2 text-xs font-semibold text-stone-500 tabular-nums">
                    {items.length}
                  </span>
                  <span className="hidden text-sm text-stone-500 sm:inline">· {g.hint}</span>
                </div>
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((r) => (
                    <LectureTile key={r.id} r={r} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

function Overview({
  label,
  value,
  hint,
  live = false,
  bar,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  live?: boolean;
  bar?: number | null;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-5 py-4 shadow-sm">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
        {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />}
        {label}
      </dt>
      <dd className="mt-1 font-display font-bold text-3xl text-ink tabular-nums">{value}</dd>
      {bar !== undefined ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100" aria-hidden>
          <div className="h-full rounded-full bg-brand-600" style={{ width: `${bar ?? 0}%` }} />
        </div>
      ) : (
        hint && <p className="mt-0.5 text-xs text-stone-500">{hint}</p>
      )}
    </div>
  );
}

type Row = {
  id: string;
  title: string;
  status: SurveyStatus;
  quizId: string | null;
  active: number;
  removed: number;
  source: string;
  sourceType: string;
  created: string;
  started: number;
  completed: number;
  reviewed: number;
  reviewTarget: number;
};

function LectureTile({ r }: { r: Row }) {
  const main = r.quizId ? `/admin/quiz/${r.quizId}` : `/admin/lectures/${r.id}`;
  const completion = r.started ? Math.round((r.completed / r.started) * 100) : 0;
  const reviewPct = r.reviewTarget ? Math.round((Math.min(r.reviewed, r.reviewTarget) / r.reviewTarget) * 100) : 0;
  const dot = r.status === "open" ? "bg-emerald-500" : r.status === "draft" ? "bg-amber-400" : "bg-stone-300";

  return (
    <li className="group relative flex flex-col rounded-2xl border border-line bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-3 text-xs text-stone-500">
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
            {r.status === "draft" ? "Draft" : r.status === "open" ? "Live" : "Closed"}
          </span>
          <span className="inline-flex items-center gap-1">
            <ClockIcon /> {r.created}
          </span>
        </div>

        {/* The title link covers the whole tile; the action links below sit above it. */}
        <Link
          href={main}
          className="mt-3 line-clamp-2 text-lg leading-snug font-semibold text-ink after:absolute after:inset-0 focus-visible:outline-none"
        >
          {r.title}
        </Link>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-stone-500">
          <span>
            {r.active} question{r.active === 1 ? "" : "s"}
          </span>
          {r.removed > 0 && <span className="text-rose-600">· {r.removed} removed</span>}
          <span className="inline-flex min-w-0 items-center gap-1">
            · {r.sourceType === "pdf" ? <FileIcon className="shrink-0" /> : <TextIcon className="shrink-0" />}
            <span className="max-w-40 truncate">{r.source}</span>
          </span>
        </p>

        <div className="mt-auto pt-5">
          {r.status === "draft" ? (
            <p className="rounded-lg bg-stone-50 px-3 py-2.5 text-sm text-stone-600">
              Not published yet. Review the questions first.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Meter label="Students" value={`${r.completed}/${r.started}`} pct={completion} tone="bg-brand-600" />
              <Meter label="Expert review" value={`${reviewPct}%`} pct={reviewPct} tone="bg-violet-500" />
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 flex items-center gap-0.5 border-t border-line px-3 py-2">
        {r.quizId ? (
          <>
            <QuickLink href={`/admin/results/${r.quizId}`} icon={<ChartIcon />} label="Results" />
            <QuickLink href={`/admin/review/${r.quizId}`} icon={<ShieldIcon />} label="Review" />
            <QuickLink href={`/admin/present/${r.quizId}`} icon={<QrIcon />} label="QR" newTab />
          </>
        ) : (
          <QuickLink href={`/admin/lectures/${r.id}`} icon={<ArrowRightIcon />} label="Review questions" />
        )}
      </div>
    </li>
  );
}

function Meter({ label, value, pct, tone }: { label: string; value: string; pct: number; tone: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-stone-500">{label}</span>
        <span className="font-semibold text-ink tabular-nums">{value}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100" aria-hidden>
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  label,
  newTab = false,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  newTab?: boolean;
}) {
  return (
    <Link
      href={href}
      target={newTab ? "_blank" : undefined}
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-stone-600 transition hover:bg-field hover:text-brand-700"
    >
      {icon} {label}
    </Link>
  );
}
