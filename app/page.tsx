import Link from "next/link";
import { ArrowRightIcon, ChartIcon, LogoMark, QrIcon, SparklesIcon } from "@/components/icons";

const STEPS = [
  { icon: <SparklesIcon />, title: "Generate", text: "An LLM writes multiple-choice questions from lecture notes." },
  { icon: <QrIcon />, title: "Survey", text: "Students answer and rate each question in class." },
  { icon: <ChartIcon />, title: "Analyse", text: "Compare student ratings with expert review." },
];

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col overflow-hidden">
            <div className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-16">
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <span className="font-semibold text-stone-900">QuizCheck</span>
        </div>
        <p className="mt-10 inline-flex w-fit items-center gap-2 rounded-sm border-2 border-line bg-yellow-300 px-3 py-1 text-xs font-semibold tracking-wider text-ink uppercase shadow-xs">
          COMP-5112 research project
        </p>
        <h1 className="mt-4 text-3xl leading-tight text-ink sm:text-5xl sm:leading-[1.1]">
          Accuracy and Usefulness of{" "}
          <span className="highlight">AI-Generated Practice Questions</span>{" "}
          from Lecture Notes
        </h1>
        <p className="mt-5 max-w-xl text-lg text-stone-600">
          Students: please use the link or QR code shown in class to take the survey.
        </p>
        <div className="mt-8">
          <Link href="/admin" className="btn-primary">
            Researcher dashboard <ArrowRightIcon />
          </Link>
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.title} className="card">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{s.icon}</span>
              <p className="mt-3 font-semibold text-stone-900">{s.title}</p>
              <p className="mt-1 text-sm text-stone-500">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
