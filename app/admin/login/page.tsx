import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, ChartIcon, CheckIcon, LockIcon, ShieldIcon, SparklesIcon, Wordmark } from "@/components/icons";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Researcher login", robots: { index: false } };

const INSIDE = [
  { icon: <SparklesIcon />, text: "Generate questions from lecture notes" },
  { icon: <ShieldIcon />, text: "Review, publish and run expert scoring" },
  { icon: <ChartIcon />, text: "Results, charts and CSV exports" },
];

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-4xl">
        <Link href="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-ink">
          <ArrowLeftIcon /> Back to home
        </Link>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Black tile: what this is */}
          <section className="flex flex-col justify-between rounded-2xl bg-ink p-8 text-white shadow-sm sm:p-10">
            <div>
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-xl text-ink">
                <CheckIcon strokeWidth={3} />
              </span>
              <h1 className="mt-6 text-3xl text-white sm:text-4xl">Researcher login</h1>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                <Wordmark onDark /> dashboard for the COMP-5112 study on AI-generated practice questions.
              </p>
            </div>
            <ul className="mt-10 space-y-3">
              {INSIDE.map((item) => (
                <li key={item.text} className="flex items-center gap-3 text-sm text-white/80">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-accent-bright">{item.icon}</span>
                  {item.text}
                </li>
              ))}
            </ul>
          </section>

          {/* White tile: the form */}
          <section className="flex flex-col justify-center rounded-2xl border border-line bg-surface p-8 shadow-sm sm:p-10">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-lg text-accent-bright">
              <LockIcon />
            </span>
            <h2 className="mt-5 text-2xl text-ink">Sign in</h2>
            <p className="mt-1 text-sm text-stone-500">Enter the admin password to continue.</p>
            <LoginForm />
            <p className="mt-6 text-xs text-stone-400">Students don&apos;t need to sign in: they use the link or QR code shown in class.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
