import Link from "next/link";
import { Wordmark, ArrowRightIcon, ChartIcon, LockIcon, LogoMark, QrIcon, SparklesIcon } from "@/components/icons";

const STEPS = [
  {
    icon: <SparklesIcon />,
    title: "Generate",
    text: "An AI model writes multiple-choice questions from lecture notes.",
  },
  {
    icon: <QrIcon />,
    title: "Survey",
    text: "Students answer and rate each question in class.",
  },
  {
    icon: <ChartIcon />,
    title: "Analyse",
    text: "Student ratings are compared with expert review.",
  },
];

const tile = "rounded-2xl border border-line bg-surface p-6 shadow-sm";

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-8">
        <header className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <Wordmark />
          </div>
          <span className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-ink">
            COMP-5112 research project
          </span>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Title */}
          <section className={`${tile} flex flex-col justify-end sm:col-span-2 lg:col-span-3 lg:row-span-2 lg:p-10`}>
            <p className="text-sm font-semibold text-stone-500">Research study</p>
            <h1 className="mt-3 text-3xl leading-tight text-ink sm:text-4xl lg:text-5xl lg:leading-[1.08]">
              Accuracy and Usefulness of{" "}
              {/* Looks like selected text: very light highlight with a selection handle at each end.
                  The handles are empty inline markers glued to the first and last word, so they follow any line wrap. */}
              <span className="bg-[#F4F0E2] px-0.5 box-decoration-clone">
                <Handle side="start" />
                AI-Generated Practice Questions
                <Handle side="end" />
              </span>{" "}
              from Lecture Notes
            </h1>
          </section>

          {/* Students */}
          <section className="flex flex-col justify-between rounded-2xl border border-line bg-stone-100 p-6 shadow-sm">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-lg text-accent-bright">
              <QrIcon />
            </span>
            <p className="mt-6 text-sm leading-relaxed text-ink">
              <span className="font-semibold">Students:</span> use the link or QR code shown in class to take the survey.
            </p>
          </section>

          {/* Researcher dashboard */}
          <Link
            href="/admin"
            className="group flex flex-col justify-between rounded-2xl bg-brand-700 p-6 text-white shadow-sm transition hover:bg-brand-800"
          >
            <span className="text-sm font-medium text-white/70">For researchers</span>
            <span className="mt-8 flex items-end justify-between gap-3">
              <span className="text-xl leading-snug font-semibold">Open the dashboard</span>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-accent-bright transition group-hover:translate-x-1">
                <ArrowRightIcon />
              </span>
            </span>
          </Link>

          {/* Steps */}
          {STEPS.map((s, i) => (
            <section key={s.title} className={tile}>
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-accent-bright">{s.icon}</span>
                <span className="text-xs font-semibold text-stone-400">0{i + 1}</span>
              </div>
              <p className="mt-4 font-semibold text-ink">{s.title}</p>
              <p className="mt-1 text-sm text-stone-500">{s.text}</p>
            </section>
          ))}

          {/* Privacy */}
          <section className={tile}>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-accent-bright">
              <LockIcon />
            </span>
            <p className="mt-4 font-semibold text-ink">Anonymous</p>
            <p className="mt-1 text-sm text-stone-500">Voluntary, no names or student IDs, and you can stop at any time.</p>
          </section>
        </div>
      </div>
    </main>
  );
}

/** Text-selection handle: a thin bar with a dot on top (start) or underneath (end). Decorative. */
function Handle({ side }: { side: "start" | "end" }) {
  return (
    <span aria-hidden className="relative">
      <span className={`absolute top-[0.08em] h-[1.02em] w-[2px] bg-ink ${side === "start" ? "-left-[3px]" : "-right-[3px]"}`}>
        <span
          className={`absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-ink ${side === "start" ? "-top-1.5" : "-bottom-1.5"}`}
        />
      </span>
    </span>
  );
}
