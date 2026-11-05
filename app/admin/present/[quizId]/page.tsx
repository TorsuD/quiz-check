import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { loadQuizBundle } from "@/lib/quiz";
import { quizUrlAndQr } from "@/lib/url";

export const metadata: Metadata = { title: "Scan to join", robots: { index: false } };

// Full-screen QR code for projecting during class.
export default function PresentPage({ params }: PageProps<"/admin/present/[quizId]">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-white px-6 py-10 text-center">
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
    <>
      <p className="text-xl text-stone-500">Scan to take the practice quiz</p>
      <h1 className="mt-2 text-4xl font-semibold text-stone-900">{bundle.quiz.title}</h1>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt={`QR code for ${url}`} className="mt-8 aspect-square w-[min(70vh,80vw)]" />
      <p className="mt-6 font-mono text-xl break-all text-stone-700">{url}</p>
      <p className="mt-3 text-stone-500">Anonymous · about 10 minutes · {bundle.questions.length} questions</p>
    </>
  );
}
