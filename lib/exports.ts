import "server-only";
import { LETTERS } from "./constants";
import { Participant, QuestionResponse, SurveyResponse } from "./models";
import { loadQuizBundle } from "./quiz";

/** One row per participant per question (blank cells where the participant did not answer). */
export async function buildResponsesCsvRows(quizId: string) {
  const bundle = await loadQuizBundle(quizId);
  if (!bundle) return null;
  const { questions } = bundle;
  const [participants, responses] = await Promise.all([
    Participant.find({ quizId }).sort({ consentedAt: 1 }).lean(),
    QuestionResponse.find({ quizId }).lean(),
  ]);
  const respMap = new Map(responses.map((r) => [`${r.participantId}:${String(r.questionId)}`, r]));

  const headers = [
    "quizId",
    "participantId",
    "participantStartedAt",
    "participantCompletedAt",
    "questionNumber",
    "questionId",
    "llmDifficulty",
    "question",
    "answered",
    "selectedOption",
    "correctOption",
    "isCorrect",
    "clarity",
    "difficulty",
    "usefulness",
    "perceivedAccuracy",
    "flaggedError",
    "answeredAt",
    "ratedAt",
  ];
  const rows = participants.flatMap((p) =>
    questions.map((q, i) => {
      const r = respMap.get(`${p.participantId}:${String(q._id)}`);
      return [
        quizId,
        p.participantId,
        p.consentedAt,
        p.completedAt,
        i + 1,
        String(q._id),
        q.difficulty,
        q.question,
        r ? 1 : 0,
        r ? LETTERS[r.selectedIndex] : "",
        LETTERS[q.correctIndex],
        r ? (r.isCorrect ? 1 : 0) : "",
        r?.clarity,
        r?.difficulty,
        r?.usefulness,
        r?.perceivedAccuracy,
        r ? (r.flaggedError ? 1 : 0) : "",
        r?.answeredAt,
        r?.ratedAt,
      ];
    }),
  );
  return { headers, rows };
}

export async function buildSurveyCsvRows(quizId: string) {
  const bundle = await loadQuizBundle(quizId);
  if (!bundle) return null;
  const surveys = await SurveyResponse.find({ quizId }).sort({ createdAt: 1 }).lean();
  const headers = [
    "quizId",
    "participantId",
    "wouldUse",
    "comparedToInstructor",
    "comparedToInstructorScore",
    "examHelp",
    "helpfulText",
    "unhelpfulText",
    "submittedAt",
  ];
  const scale = ["much worse", "worse", "about the same", "better", "much better"];
  const rows = surveys.map((s) => [
    quizId,
    s.participantId,
    s.wouldUse,
    s.comparedToInstructor,
    scale.indexOf(s.comparedToInstructor) + 1,
    s.examHelp,
    s.helpfulText,
    s.unhelpfulText,
    s.createdAt,
  ]);
  return { headers, rows };
}
