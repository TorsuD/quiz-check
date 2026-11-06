import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { REVIEWERS } from "@/config/reviewers";
import { LoadingCard, PageHeader, StatCard } from "@/components/admin-ui";
import { AlertIcon, ArrowLeftIcon, ChartIcon, CheckIcon, DownloadIcon, ShieldIcon, UsersIcon } from "@/components/icons";
import { SURVEY } from "@/lib/constants";
import { computeResults, type QuestionResult, type Results } from "@/lib/results";
import { describeKappa, pct } from "@/lib/stats";
import { Columns, ExpertVsStudentScatter, HBars, VerdictChart } from "./Charts";

export default function ResultsPage({ params }: PageProps<"/admin/results/[quizId]">) {
  return (
    <Suspense fallback={<LoadingCard label="Calculating results…" />}>
      <ResultsContent params={params} />
    </Suspense>
  );
}

// ---------- formatting ----------
const fmtPct = (v: number | null) => (v === null ? "–" : `${Math.round(v)}%`);
const fmt1 = (v: number | null) => (v === null ? "–" : v.toFixed(1));
const fmtK = (v: number | null) => (v === null ? "–" : v.toFixed(2));
const fmtRho = (v: number | null) => (v === null ? "–" : (v > 0 ? "+" : "") + v.toFixed(2));

function Section({ n, title, intro, children }: { n: number; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border-2 border-line bg-yellow-300 text-xs font-semibold text-ink">
          {n}
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{title}</h2>
          {intro && <p className="mt-1 text-sm text-stone-600">{intro}</p>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-md border-2 border-dashed border-stone-300 px-4 py-6 text-center text-sm text-stone-500">{children}</p>;
}

function Verdict({ v }: { v: QuestionResult["expertVerdict"] }) {
  if (v === null) return <span className="text-xs text-stone-400">not reviewed</span>;
  const style = { accurate: "text-emerald-700", split: "text-amber-700", "not accurate": "text-rose-700" }[v];
  const label = { accurate: "Accurate", split: "Split", "not accurate": "Not accurate" }[v];
  return <span className={`pill ${style}`}>{label}</span>;
}

/** Plain-HTML bars for a 1–5 answer distribution (each bar labelled, so no legend needed). */
function DistBars({ dist, low, high }: { dist: number[]; low: string; high: string }) {
  const total = dist.reduce((a, b) => a + b, 0);
  return (
    <div>
      <ul className="space-y-1.5">
        {dist.map((c, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            <span className="w-3 text-right font-semibold text-stone-600">{i + 1}</span>
            <span className="h-3 flex-1 overflow-hidden rounded-xs bg-stone-100">
              <span className="block h-full rounded-r-[4px] bg-brand-600" style={{ width: `${total ? (c / total) * 100 : 0}%` }} />
            </span>
            <span className="w-14 text-right text-stone-600 tabular-nums">
              {c} <span className="text-stone-400">({fmtPct(pct(c, total))})</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 flex justify-between pl-5 text-[11px] text-stone-500">
        <span>1 = {low}</span>
        <span>5 = {high}</span>
      </p>
    </div>
  );
}

const th = "px-3 py-2 text-left text-[11px] font-semibold tracking-wider text-stone-500 uppercase";
const td = "px-3 py-2 align-top tabular-nums";

async function ResultsContent({ params }: { params: Promise<{ quizId: string }> }) {
  await connection(); // database reads must happen at request time, not during prerendering
  const { quizId } = await params;
  const r = await computeResults(quizId);
  if (!r) return <p>Survey not found.</p>;

  const verdictRow = r.agreement[0];
  const disagreements = r.questions.filter((q) => q.expertVerdict === "split");
  const reviewHref = `/admin/review/${quizId}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link href={`/admin/quiz/${quizId}`} className="inline-flex items-center gap-1.5 text-stone-500 hover:text-brand-700">
            <ArrowLeftIcon /> Survey
          </Link>
        }
        title="Results"
        subtitle={`${r.quiz.title} · ${r.quiz.isOpen ? "survey still open, numbers update live" : "survey closed"}`}
        actions={
          <>
            <Link href={reviewHref} className="btn-secondary">
              <ShieldIcon /> Expert review
            </Link>
            <a href={`/api/admin/quizzes/${quizId}/export/full`} className="btn-primary">
              <DownloadIcon /> Full CSV
            </a>
          </>
        }
      />

      {/* Headline numbers */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Accuracy rate"
          value={fmtPct(pct(r.consensus.bothAccurate, r.consensus.bothReviewed))}
          hint={
            r.consensus.bothReviewed
              ? `${r.consensus.bothAccurate} of ${r.consensus.bothReviewed} questions, both reviewers agree`
              : "needs both reviewers' scores"
          }
          icon={<CheckIcon />}
          tone="emerald"
        />
        <StatCard
          label="Reviewer agreement"
          value={fmtPct(verdictRow.agreement)}
          hint={verdictRow.n ? `κ = ${fmtK(verdictRow.kappa)} (${describeKappa(verdictRow.kappa)})` : "needs both reviewers' scores"}
          icon={<ShieldIcon />}
          tone="violet"
        />
        <StatCard
          label="Students completed"
          value={r.students.completed}
          hint={`${r.students.started} started · ${r.survey.n} final surveys`}
          icon={<UsersIcon />}
          tone="brand"
        />
        <StatCard
          label="Usefulness"
          value={r.students.usefulness === null ? "–" : `${fmt1(r.students.usefulness)} / 5`}
          hint="students' mean rating per question"
          icon={<ChartIcon />}
          tone="amber"
        />
      </div>

      {/* 1. Accuracy */}
      <Section
        n={1}
        title="Accuracy (expert review)"
        intro={
          <>
            A question counts as <strong>accurate</strong> when a reviewer marks it factually correct <em>and</em> its answer
            key correct. Measured on all {r.generation.total} generated questions, including the {r.generation.removed} removed
            before the survey.
          </>
        }
      >
        {r.perReviewer.every((p) => p.reviewed === 0) ? (
          <Empty>
            No expert scores yet. <Link href={reviewHref} className="font-semibold text-brand-700 underline">Start the expert review</Link>.
          </Empty>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 font-sans text-sm font-semibold tracking-normal">Factual correctness by reviewer</h3>
              <VerdictChart data={r.perReviewer.map((p) => ({ name: p.name, ...p.factual }))} />
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b-2 border-line">
                    <tr>
                      <th className={th}>Reviewer</th>
                      <th className={th}>Scored</th>
                      <th className={th}>Accurate</th>
                      <th className={th}>Wrong key</th>
                      <th className={th}>Relevance</th>
                      <th className={th}>Clarity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {r.perReviewer.map((p) => (
                      <tr key={p.id}>
                        <td className={`${td} font-semibold`}>{p.name}</td>
                        <td className={td}>
                          {p.reviewed}/{r.generation.total}
                        </td>
                        <td className={td}>{fmtPct(p.accuracyPct)}</td>
                        <td className={td}>{p.answerKeyWrong}</td>
                        <td className={td}>{fmt1(p.meanRelevance)}</td>
                        <td className={td}>{fmt1(p.meanClarity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-stone-600">
                Strict (both reviewers say accurate):{" "}
                <strong>{fmtPct(pct(r.consensus.bothAccurate, r.consensus.bothReviewed))}</strong> · Lenient (at least one
                does): <strong>{fmtPct(pct(r.consensus.eitherAccurate, r.consensus.bothReviewed))}</strong>
              </p>
            </div>
            <div>
              <h3 className="mb-2 font-sans text-sm font-semibold tracking-normal">Problems found</h3>
              {r.errorTags.some((t) => t.questions > 0) ? (
                <HBars
                  unit="questions"
                  data={[...r.errorTags].sort((a, b) => b.questions - a.questions).map((t) => ({ label: t.tag, value: t.questions }))}
                />
              ) : (
                <Empty>No problems tagged yet.</Empty>
              )}
              <p className="mt-2 text-xs text-stone-500">Number of questions where at least one reviewer used the tag.</p>
              <ul className="mt-4 space-y-1.5 text-xs text-stone-600">
                <li className="flex gap-2">
                  <AlertIcon className="mt-0.5 shrink-0 text-amber-600" />
                  {r.generation.excerptMissing} of {r.generation.total} cited excerpts were not found word for word in the notes
                  (a hallucination warning sign).
                </li>
                <li className="flex gap-2">
                  <AlertIcon className="mt-0.5 shrink-0 text-rose-600" />
                  {r.generation.removed} of {r.generation.total} questions were removed by the researcher before the survey.
                </li>
              </ul>
            </div>
          </div>
        )}
      </Section>

      {/* 2. Agreement */}
      <Section
        n={2}
        title="Reviewer agreement"
        intro={
          <>
            How consistently {REVIEWERS[0].name} and {REVIEWERS[1].name} judged the same questions. Cohen&apos;s κ corrects for
            agreement expected by chance (Landis &amp; Koch: 0.41–0.60 moderate, 0.61–0.80 substantial, above 0.80 almost
            perfect).
          </>
        }
      >
        {r.consensus.bothReviewed === 0 ? (
          <Empty>Agreement appears once both reviewers have scored the same questions.</Empty>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b-2 border-line">
                  <tr>
                    <th className={th}>Judgment</th>
                    <th className={th}>Questions</th>
                    <th className={th}>Agreement</th>
                    <th className={th}>Cohen&apos;s κ</th>
                    <th className={th}>Within ±1</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {r.agreement.map((a) => (
                    <tr key={a.label}>
                      <td className={td}>
                        <span className="font-semibold">{a.label}</span>
                        <span className="block text-xs text-stone-500">{a.detail}</span>
                      </td>
                      <td className={td}>{a.n}</td>
                      <td className={td}>{fmtPct(a.agreement)}</td>
                      <td className={td}>
                        {fmtK(a.kappa)} <span className="text-xs text-stone-500">{describeKappa(a.kappa)}</span>
                      </td>
                      <td className={td}>{a.withinOne === undefined ? "" : fmtPct(a.withinOne)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-stone-500">
              κ can be low even when agreement is high if one reviewer gives nearly the same answer every time (the
              &ldquo;kappa paradox&rdquo;). Report both numbers.
            </p>
            <div className="mt-5">
              <h3 className="font-sans text-sm font-semibold tracking-normal">Questions the reviewers disagree on ({disagreements.length})</h3>
              {disagreements.length === 0 ? (
                <p className="mt-1 text-sm text-stone-500">None: the reviewers reached the same verdict on every question.</p>
              ) : (
                <>
                  <p className="mt-1 text-xs text-stone-500">Discuss these together, then record the agreed verdict in your write-up.</p>
                  <ul className="mt-2 space-y-1.5">
                    {disagreements.map((q) => (
                      <li key={q.id} className="flex gap-2 text-sm">
                        <span className="font-semibold text-stone-500">#{q.number}</span>
                        <span className="flex-1">{q.question}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </>
        )}
      </Section>

      {/* 3. Students */}
      <Section
        n={3}
        title="Students: performance and ratings"
        intro="Ratings are 1–5 and describe the question itself. % correct is each question's real difficulty."
      >
        {r.students.answers === 0 ? (
          <Empty>No student answers yet. Share the QR code from the survey page.</Empty>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ["Answered correctly", fmtPct(r.students.correctPct)],
                ["Clarity", fmt1(r.students.clarity)],
                ["Difficulty", fmt1(r.students.difficulty)],
                ["Usefulness", fmt1(r.students.usefulness)],
                ["Perceived accuracy", fmt1(r.students.perceivedAccuracy)],
                ["Flagged as error", fmtPct(r.students.flaggedPct)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-md border-2 border-line bg-field px-3 py-2">
                  <dt className="text-[11px] text-stone-500">{k}</dt>
                  <dd className="font-display text-xl text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <h3 className="mt-6 mb-2 font-sans text-sm font-semibold tracking-normal">% of students answering correctly, per survey question</h3>
            <Columns
              unit="%"
              max={100}
              reference={r.students.correctPct === null ? undefined : { value: r.students.correctPct, label: "average" }}
              data={r.questions
                .filter((q) => q.students)
                .map((q) => ({ label: `Q${q.surveyNumber}`, value: q.students!.correctPct, title: q.question }))}
            />
          </>
        )}

        <h3 className="mt-6 mb-2 font-sans text-sm font-semibold tracking-normal">Every generated question</h3>
        <div className="overflow-x-auto rounded-md border-2 border-line">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b-2 border-line bg-stone-50">
              <tr>
                <th className={th}>#</th>
                <th className={th}>Question</th>
                <th className={th}>Experts</th>
                <th className={th}>Answers</th>
                <th className={th}>Correct</th>
                <th className={th}>Clarity</th>
                <th className={th}>Difficulty</th>
                <th className={th}>Useful</th>
                <th className={th}>Perc. acc.</th>
                <th className={th}>Flagged</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {r.questions.map((q) => (
                <tr key={q.id} className={q.removed ? "bg-rose-50/60" : undefined}>
                  <td className={`${td} text-stone-500`}>
                    {q.number}
                    {q.surveyNumber && <span className="block text-[10px]">Q{q.surveyNumber}</span>}
                  </td>
                  <td className={`${td} max-w-xs`}>
                    <span className="line-clamp-2">{q.question}</span>
                    {q.removed && <span className="text-[11px] text-rose-700">Removed before survey</span>}
                  </td>
                  <td className={td}>
                    <Verdict v={q.expertVerdict} />
                  </td>
                  {q.students ? (
                    <>
                      <td className={td}>{q.students.answered}</td>
                      <td className={td}>{fmtPct(q.students.correctPct)}</td>
                      <td className={td}>{fmt1(q.students.clarity)}</td>
                      <td className={td}>{fmt1(q.students.difficulty)}</td>
                      <td className={td}>{fmt1(q.students.usefulness)}</td>
                      <td className={td}>{fmt1(q.students.perceivedAccuracy)}</td>
                      <td className={td}>{fmtPct(q.students.flaggedPct)}</td>
                    </>
                  ) : (
                    <td className={`${td} text-xs text-stone-400`} colSpan={7}>
                      not shown to students
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 4. Final survey */}
      <Section n={4} title="Final survey" intro={`${r.survey.n} students submitted the final survey.`}>
        {r.survey.n === 0 ? (
          <Empty>No final surveys yet.</Empty>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-3">
              <div>
                <h3 className="font-sans text-sm font-semibold tracking-normal">{SURVEY.wouldUse}</h3>
                <p className="mt-1 mb-3 text-xs text-stone-500">Mean {fmt1(r.survey.wouldUse.mean)} / 5</p>
                <DistBars dist={r.survey.wouldUse.dist} low="definitely not" high="definitely yes" />
              </div>
              <div>
                <h3 className="font-sans text-sm font-semibold tracking-normal">{SURVEY.examHelp}</h3>
                <p className="mt-1 mb-3 text-xs text-stone-500">Mean {fmt1(r.survey.examHelp.mean)} / 5</p>
                <DistBars dist={r.survey.examHelp.dist} low="not at all" high="a great deal" />
              </div>
              <div>
                <h3 className="font-sans text-sm font-semibold tracking-normal">{SURVEY.comparedToInstructor}</h3>
                <div className="mt-3">
                  <HBars unit="students" data={r.survey.compared.map((c) => ({ label: c.option, value: c.count }))} />
                </div>
              </div>
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {(
                [
                  [SURVEY.helpfulText, r.survey.helpful],
                  [SURVEY.unhelpfulText, r.survey.unhelpful],
                ] as const
              ).map(([title, answers]) => (
                <details key={title} className="rounded-md border-2 border-line bg-field p-3">
                  <summary className="cursor-pointer text-sm font-semibold">
                    {title} <span className="font-normal text-stone-500">({answers.length})</span>
                  </summary>
                  {answers.length === 0 ? (
                    <p className="mt-2 text-sm text-stone-500">No answers.</p>
                  ) : (
                    <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto text-sm text-stone-700">
                      {answers.map((a, i) => (
                        <li key={i} className="border-l-2 border-stone-300 pl-2">
                          {a}
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              ))}
            </div>
            <p className="mt-2 text-xs text-stone-500">Tip: group the open answers into themes (e.g. &ldquo;clear explanation&rdquo;, &ldquo;too easy&rdquo;) for your write-up.</p>
          </>
        )}
      </Section>

      {/* 5. Students vs experts */}
      <Section
        n={5}
        title="Do students notice inaccurate questions?"
        intro="Compares students' reactions with the expert verdicts, for survey questions that have both."
      >
        <StudentsVsExperts r={r} />
      </Section>

      <p className="text-xs text-stone-500">
        With one class and a handful of questions, treat these figures as descriptive. The full CSV has every number per
        question for analysis in SPSS, R or Excel.
      </p>
    </div>
  );
}

function StudentsVsExperts({ r }: { r: Results }) {
  const c = r.comparison;
  if (c.n === 0) {
    return <Empty>Needs expert scores and student ratings on the same survey questions.</Empty>;
  }
  const rows: [string, (g: typeof c.accurate) => string][] = [
    ["Questions", (g) => String(g.questions)],
    ["Students' perceived accuracy (1–5)", (g) => fmt1(g.perceivedAccuracy)],
    ["Flagged as an error", (g) => fmtPct(g.flaggedPct)],
    ["Answered correctly", (g) => fmtPct(g.correctPct)],
    ["Usefulness (1–5)", (g) => fmt1(g.usefulness)],
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b-2 border-line">
              <tr>
                <th className={th}>Students&apos; reaction</th>
                <th className={th}>Experts: accurate</th>
                <th className={th}>Experts: not accurate*</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {rows.map(([label, f]) => (
                <tr key={label}>
                  <td className={td}>{label}</td>
                  <td className={`${td} font-semibold`}>{f(c.accurate)}</td>
                  <td className={`${td} font-semibold`}>{f(c.notAccurate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[11px] text-stone-500">* includes questions where the reviewers were split.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b-2 border-line">
              <tr>
                <th className={th}>
                  Rank correlation (Spearman <span className="normal-case">ρ</span>)
                </th>
                <th className={th}>
                  <span className="normal-case">ρ</span>
                </th>
                <th className={th}>n</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {c.correlations.map((k) => (
                <tr key={k.label}>
                  <td className={td}>
                    {k.label}
                    <span className="block text-xs text-stone-500">Expected {k.expect}</span>
                  </td>
                  <td className={`${td} font-semibold`}>{fmtRho(k.rho)}</td>
                  <td className={td}>{k.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[11px] text-stone-500">ρ needs at least 3 questions and some variation; “–” means not enough data yet.</p>
        </div>
      </div>
      <div>
        <h3 className="mb-2 font-sans text-sm font-semibold tracking-normal">Each survey question</h3>
        {c.scatter.length ? <ExpertVsStudentScatter data={c.scatter} /> : <Empty>No questions with both kinds of data yet.</Empty>}
        <p className="mt-2 text-xs text-stone-500">
          If students can tell accurate from inaccurate questions, red dots sit lower than green ones.
        </p>
      </div>
    </div>
  );
}
