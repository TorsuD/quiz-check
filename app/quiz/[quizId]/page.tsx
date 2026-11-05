import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import { loadQuizBundle } from "@/lib/quiz";
import { Participant, QuestionResponse, SurveyResponse } from "@/lib/models";
import { getParticipantCookie } from "@/lib/participant";
import QuizFlow, { type InitialProgress, type PublicQuestion } from "./QuizFlow";

export const metadata: Metadata = {
  title: "Practice question survey",
  robots: { index: false, follow: false },
};

export default function QuizPage({ params }: PageProps<"/quiz/[quizId]">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-5 pb-10">
      <Suspense fallback={<p className="py-20 text-center text-stone-500">Loading…</p>}>
        <QuizLoader params={params} />
      </Suspense>
    </main>
  );
}

async function QuizLoader({ params }: { params: Promise<{ quizId: string }> }) {
  await connection(); // database reads must happen at request time, not during prerendering
  const { quizId } = await params;
  const bundle = await loadQuizBundle(quizId);
  if (!bundle) {
    return (
      <div className="card mt-10 text-center">
        <h1 className="text-lg font-semibold">Survey not found</h1>
        <p className="mt-2 text-stone-600">Check the link or scan the QR code again.</p>
      </div>
    );
  }
  const { quiz, questions } = bundle;

  const publicQuestions: PublicQuestion[] = questions.map((q) => ({
    id: String(q._id),
    question: q.question,
    options: q.options,
  }));

  // Resume an in-progress attempt if this browser already started.
  const participantId = await getParticipantCookie();
  const participant = participantId ? await Participant.findOne({ quizId, participantId }).lean() : null;
  let progress: InitialProgress = { started: false, completed: false, surveyDone: false, answers: {} };
  if (participant && participantId) {
    const [responses, survey] = await Promise.all([
      QuestionResponse.find({ quizId, participantId }).lean(),
      SurveyResponse.exists({ quizId, participantId }),
    ]);
    const byId = new Map(questions.map((q) => [String(q._id), q]));
    progress = {
      started: true,
      completed: Boolean(participant.completedAt),
      surveyDone: Boolean(survey),
      answers: Object.fromEntries(
        responses.flatMap((r) => {
          const q = byId.get(String(r.questionId));
          if (!q) return [];
          return [
            [
              String(r.questionId),
              {
                selectedIndex: r.selectedIndex,
                isCorrect: r.isCorrect,
                correctIndex: q.correctIndex,
                explanation: q.explanation,
                rated: Boolean(r.ratedAt),
              },
            ],
          ];
        }),
      ),
    };
  }

  return (
    <QuizFlow
      quizId={quizId}
      title={quiz.title}
      isOpen={quiz.isOpen}
      questions={publicQuestions}
      initial={progress}
    />
  );
}
