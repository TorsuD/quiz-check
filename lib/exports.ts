import "server-only";
import { REVIEWERS } from "@/config/reviewers";
import { LETTERS } from "./constants";
import { Participant, QuestionResponse, SurveyResponse } from "./models";
import { loadQuizBundle } from "./quiz";
import { computeResults, isAccurate } from "./results";

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
    "errorNote",
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
        r?.errorNote ?? "",
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

/**
 * Full analysis export: one row per GENERATED question (including removed ones), with both
 * reviewers' scores side by side, their agreement, and the students' aggregate results.
 */
export async function buildFullCsvRows(quizId: string) {
  const r = await computeResults(quizId);
  if (!r) return null;
  const round = (v: number | null, dp = 2) => (v === null ? "" : Number(v.toFixed(dp)));
  const [ra, rb] = REVIEWERS.map((x) => x.id);

  const reviewerHeaders = REVIEWERS.flatMap(({ id }) => [
    `reviewer${id}_factuallyCorrect`,
    `reviewer${id}_answerKeyCorrect`,
    `reviewer${id}_accurate`,
    `reviewer${id}_relevance`,
    `reviewer${id}_clarity`,
    `reviewer${id}_errorTags`,
    `reviewer${id}_note`,
  ]);
  const headers = [
    "quizId",
    "questionNumber",
    "surveyQuestionNumber",
    "questionId",
    "question",
    "optionA",
    "optionB",
    "optionC",
    "optionD",
    "correctOption",
    "llmDifficulty",
    "removedBeforeSurvey",
    "removalReason",
    "excerptFoundInText",
    ...reviewerHeaders,
    "bothReviewed",
    "reviewersAgreeOnVerdict",
    "expertVerdict",
    "expertAccuracyScore",
    "studentsAnswered",
    "studentsCorrectPct",
    "studentsRated",
    "studentMeanClarity",
    "studentMeanDifficulty",
    "studentMeanUsefulness",
    "studentMeanPerceivedAccuracy",
    "studentsFlaggedErrorPct",
    "studentErrorNotes",
  ];

  const rows = r.questions.map((q) => {
    const a = q.reviews[ra];
    const b = q.reviews[rb];
    const both = Boolean(a && b);
    const s = q.students;
    return [
      r.quiz.id,
      q.number,
      q.surveyNumber ?? "",
      q.id,
      q.question,
      ...[0, 1, 2, 3].map((i) => q.options[i] ?? ""),
      LETTERS[q.correctIndex] ?? "",
      q.llmDifficulty,
      q.removed,
      q.removalReason ?? "",
      q.excerptFound,
      ...REVIEWERS.flatMap(({ id }) => {
        const rv = q.reviews[id];
        return rv
          ? [rv.factuallyCorrect, rv.answerKeyCorrect, isAccurate(rv), rv.relevance, rv.clarity, rv.errorTags.join("; "), rv.otherNote]
          : ["", "", "", "", "", "", ""];
      }),
      both,
      both ? isAccurate(a!) === isAccurate(b!) : "",
      q.expertVerdict ?? "",
      round(q.expertScore),
      s?.answered ?? "",
      s ? round(s.correctPct, 1) : "",
      s?.rated ?? "",
      s ? round(s.clarity) : "",
      s ? round(s.difficulty) : "",
      s ? round(s.usefulness) : "",
      s ? round(s.perceivedAccuracy) : "",
      s ? round(s.flaggedPct, 1) : "",
      s ? s.errorNotes.join(" | ") : "",
    ];
  });
  return { headers, rows };
}
