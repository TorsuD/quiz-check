import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { loadQuizBundle } from "@/lib/quiz";
import { quizUrlAndQr } from "@/lib/url";
import { ClockIcon, LogoMark, ShieldIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Scan to join", robots: { index: false } };

// Full-screen QR code for projecting during class.
export default function PresentPage({ params }: PageProps<"/admin/present/[quizId]">) {
  return (
    <main className="flex flex-1 items-center justify-center bg-brand-600 bg-[radial-gradient(rgb(255_255_255/0.18)_1.5px,transparent_1.5px)] bg-size-[22px_22px] px-6 py-10">
      <Suspense fallback={null}>
        <Present params={params} />
      </Suspense>
    </main>
  );
}

async function Present({ params }: { params: Promise<{ quizId: string }> }) {
  await connection(); // database reads must happen at request time, not during prerendering
  const { quizId } = await params;
  const bundle = await loadQuizBundle(quizId);
  if (!bundle) return <p>Quiz not found.</p>;
  const { url, qr } = await quizUrlAndQr(quizId, 900);
  return (
    <div className="flex w-full max-w-6xl flex-col items-center gap-10 text-white lg:flex-row lg:justify-between">
      <div className="max-w-xl text-center lg:text-left">
        <div className="flex items-center justify-center gap-3 lg:justify-start">
          <LogoMark inverted className="h-12 w-12 text-2xl" />
          <span className="text-lg font-medium text-white/80">Practice question survey</span>
        </div>
        <h1 className="mt-6 text-4xl leading-tight font-semibold sm:text-5xl">{bundle.quiz.title}</h1>
        <p className="mt-4 text-2xl text-white/85">Scan the code to take the practice quiz</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3 text-lg lg:justify-start">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2">
            <ShieldIcon /> Anonymous
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2">
            <ClockIcon /> ~10 minutes · {bundle.questions.length} questions
          </span>
        </div>
      </div>
      <div className="rounded-md border-4 border-line bg-white p-6 text-center shadow-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt={`QR code for ${url}`} className="aspect-square w-[min(60vh,80vw)]" />
        <p className="mt-3 max-w-[min(60vh,80vw)] font-mono text-base break-all text-stone-600">{url}</p>
      </div>
    </div>
  );
}
