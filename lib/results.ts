import "server-only";
import { isValidObjectId } from "mongoose";
import { REVIEWERS } from "@/config/reviewers";
import { connectDB } from "./db";
import {
  COMPARISON_OPTIONS,
  ERROR_TAGS,
  ExpertReview,
  Participant,
  Question,
  QuestionResponse,
  Quiz,
  SurveyResponse,
  type ErrorTag,
  type ExpertReviewDoc,
} from "./models";
import { cohensKappa, distribution, mean, pct, percentAgreement, spearman } from "./stats";

/*
 * Definitions used throughout (also shown on the dashboard):
 *
 * - A review calls a question ACCURATE when it is factually correct ("yes") AND its answer
 *   key is correct. "Partially" correct counts as not accurate.
 * - The headline ACCURACY RATE uses questions scored by both reviewers, and counts a question
 *   as accurate only when both reviewers call it accurate (strict consensus).
 * - EXPERT ACCURACY SCORE (0–1, per question): mean over its reviews of
 *   factual (yes 1, partially 0.5, no 0), set to 0 when the answer key is wrong.
 *   Used for the student-vs-expert correlation.
 * - Accuracy is measured on EVERY generated question, including ones removed before the
 *   survey, so the researcher's own filtering does not inflate the AI's accuracy.
 */

export type Review = Pick<
  ExpertReviewDoc,
  "factuallyCorrect" | "answerKeyCorrect" | "relevance" | "clarity" | "errorTags" | "otherNote"
>;

export const isAccurate = (r: Review) => r.factuallyCorrect === "yes" && r.answerKeyCorrect === "yes";
const accuracyScore = (r: Review) =>
  r.answerKeyCorrect === "no" ? 0 : r.factuallyCorrect === "yes" ? 1 : r.factuallyCorrect === "partially" ? 0.5 : 0;

export type StudentStats = {
  answered: number;
  correctPct: number | null;
  rated: number;
  clarity: number | null;
  difficulty: number | null;
  usefulness: number | null;
  perceivedAccuracy: number | null;
  flaggedPct: number | null;
};

export type QuestionResult = {
  id: string;
  number: number; // order within the generated set
  surveyNumber: number | null; // position in the student survey, null if removed
  question: string;
  options: string[];
  correctIndex: number;
  llmDifficulty: string;
  removed: boolean;
  removalReason: string | null;
  excerptFound: boolean;
  reviews: Record<string, Review | null>;
  reviewCount: number;
  /** null until at least one review exists */
  expertVerdict: "accurate" | "not accurate" | "split" | null;
  expertScore: number | null;
  students: StudentStats | null;
};

export type AgreementRow = {
  label: string;
  detail: string;
  n: number;
  agreement: number | null;
  kappa: number | null;
  /** weighted ratings: share within ±1 point */
  withinOne?: number | null;
};

export async function computeResults(quizId: string) {
  if (!isValidObjectId(quizId)) return null;
  await connectDB();
  const quiz = await Quiz.findById(quizId).lean();
  if (!quiz) return null;

  const [questionDocs, reviewDocs, participants, responses, surveys] = await Promise.all([
    Question.find({ lectureId: quiz.lectureId }).sort({ order: 1 }).lean(),
    ExpertReview.find({ quizId }).lean(),
    Participant.find({ quizId }).lean(),
    QuestionResponse.find({ quizId }).lean(),
    SurveyResponse.find({ quizId }).sort({ createdAt: 1 }).lean(),
  ]);

  const surveyPos = new Map(quiz.questionIds.map((id, i) => [String(id), i + 1]));
  const reviewMap = new Map(reviewDocs.map((r) => [`${String(r.questionId)}:${r.reviewer}`, r]));
  const respByQuestion = new Map<string, typeof responses>();
  for (const r of responses) {
    const key = String(r.questionId);
    respByQuestion.set(key, [...(respByQuestion.get(key) ?? []), r]);
  }

  const questions: QuestionResult[] = questionDocs.map((q, i) => {
    const id = String(q._id);
    const reviews: Record<string, Review | null> = {};
    for (const rv of REVIEWERS) reviews[rv.id] = reviewMap.get(`${id}:${rv.id}`) ?? null;
    const present = Object.values(reviews).filter((r): r is Review => r !== null);
    const verdicts = present.map(isAccurate);
    const expertVerdict =
      present.length === 0 ? null : verdicts.every(Boolean) ? "accurate" : verdicts.some(Boolean) ? "split" : "not accurate";

    const surveyNumber = surveyPos.get(id) ?? null;
    let students: StudentStats | null = null;
    if (surveyNumber !== null) {
      const rs = respByQuestion.get(id) ?? [];
      const rated = rs.filter((r) => r.ratedAt);
      const avg = (k: "clarity" | "difficulty" | "usefulness" | "perceivedAccuracy") =>
        mean(rated.map((r) => r[k]).filter((v): v is number => typeof v === "number"));
      students = {
        answered: rs.length,
        correctPct: pct(rs.filter((r) => r.isCorrect).length, rs.length),
        rated: rated.length,
        clarity: avg("clarity"),
        difficulty: avg("difficulty"),
        usefulness: avg("usefulness"),
        perceivedAccuracy: avg("perceivedAccuracy"),
        flaggedPct: pct(rated.filter((r) => r.flaggedError).length, rated.length),
      };
    }

    return {
      id,
      number: i + 1,
      surveyNumber,
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      llmDifficulty: q.difficulty,
      removed: q.removedBeforeSurvey,
      removalReason: q.removalReason,
      excerptFound: q.excerptFoundInText,
      reviews,
      reviewCount: present.length,
      expertVerdict,
      expertScore: present.length ? mean(present.map(accuracyScore)) : null,
      students,
    };
  });

  // ---------- Expert accuracy ----------
  const perReviewer = REVIEWERS.map((rv) => {
    const rs = questions.map((q) => q.reviews[rv.id]).filter((r): r is Review => r !== null);
    return {
      id: rv.id,
      name: rv.name,
      reviewed: rs.length,
      accurate: rs.filter(isAccurate).length,
      accuracyPct: pct(rs.filter(isAccurate).length, rs.length),
      factual: {
        yes: rs.filter((r) => r.factuallyCorrect === "yes").length,
        partially: rs.filter((r) => r.factuallyCorrect === "partially").length,
        no: rs.filter((r) => r.factuallyCorrect === "no").length,
      },
      answerKeyWrong: rs.filter((r) => r.answerKeyCorrect === "no").length,
      meanRelevance: mean(rs.map((r) => r.relevance)),
      meanClarity: mean(rs.map((r) => r.clarity)),
    };
  });

  const [ra, rb] = REVIEWERS.map((r) => r.id);
  const both = questions.filter((q) => q.reviews[ra] && q.reviews[rb]);
  const pairsOf = <T>(f: (r: Review) => T) => both.map((q) => [f(q.reviews[ra]!), f(q.reviews[rb]!)] as [T, T]);
  const within1 = (pairs: [number, number][]) =>
    pairs.length ? (pairs.filter(([a, b]) => Math.abs(a - b) <= 1).length / pairs.length) * 100 : null;

  const consensus = {
    bothReviewed: both.length,
    bothAccurate: both.filter((q) => isAccurate(q.reviews[ra]!) && isAccurate(q.reviews[rb]!)).length,
    eitherAccurate: both.filter((q) => isAccurate(q.reviews[ra]!) || isAccurate(q.reviews[rb]!)).length,
  };

  const verdictPairs = pairsOf(isAccurate);
  const factualPairs = pairsOf((r) => r.factuallyCorrect);
  const keyPairs = pairsOf((r) => r.answerKeyCorrect);
  const anyErrorPairs = pairsOf((r) => r.errorTags.length > 0);
  const relevancePairs = pairsOf((r) => r.relevance);
  const clarityPairs = pairsOf((r) => r.clarity);

  const agreement: AgreementRow[] = [
    {
      label: "Overall verdict",
      detail: "accurate vs not accurate",
      n: both.length,
      agreement: percentAgreement(verdictPairs),
      kappa: cohensKappa(verdictPairs),
    },
    {
      label: "Factually correct",
      detail: "yes / partially / no",
      n: both.length,
      agreement: percentAgreement(factualPairs),
      kappa: cohensKappa(factualPairs),
    },
    {
      label: "Answer key correct",
      detail: "yes / no",
      n: both.length,
      agreement: percentAgreement(keyPairs),
      kappa: cohensKappa(keyPairs),
    },
    {
      label: "Any error found",
      detail: "at least one error tag",
      n: both.length,
      agreement: percentAgreement(anyErrorPairs),
      kappa: cohensKappa(anyErrorPairs),
    },
    {
      label: "Relevance",
      detail: "1–5, exact match",
      n: both.length,
      agreement: percentAgreement(relevancePairs),
      kappa: cohensKappa(relevancePairs),
      withinOne: within1(relevancePairs),
    },
    {
      label: "Clarity",
      detail: "1–5, exact match",
      n: both.length,
      agreement: percentAgreement(clarityPairs),
      kappa: cohensKappa(clarityPairs),
      withinOne: within1(clarityPairs),
    },
  ];

  // Questions where at least one reviewer used each error tag.
  const errorTags = ERROR_TAGS.map((tag) => ({
    tag,
    questions: questions.filter((q) => Object.values(q.reviews).some((r) => r?.errorTags.includes(tag as ErrorTag))).length,
  }));

  // ---------- Students ----------
  const inSurvey = questions.filter((q) => q.students);
  const rated = responses.filter((r) => r.ratedAt);
  const avgAll = (k: "clarity" | "difficulty" | "usefulness" | "perceivedAccuracy") =>
    mean(rated.map((r) => r[k]).filter((v): v is number => typeof v === "number"));
  const students = {
    started: participants.length,
    completed: participants.filter((p) => p.completedAt).length,
    answers: responses.length,
    correctPct: pct(responses.filter((r) => r.isCorrect).length, responses.length),
    clarity: avgAll("clarity"),
    difficulty: avgAll("difficulty"),
    usefulness: avgAll("usefulness"),
    perceivedAccuracy: avgAll("perceivedAccuracy"),
    flaggedPct: pct(rated.filter((r) => r.flaggedError).length, rated.length),
  };

  const survey = {
    n: surveys.length,
    wouldUse: { mean: mean(surveys.map((s) => s.wouldUse)), dist: distribution(surveys.map((s) => s.wouldUse)) },
    examHelp: { mean: mean(surveys.map((s) => s.examHelp)), dist: distribution(surveys.map((s) => s.examHelp)) },
    compared: COMPARISON_OPTIONS.map((option) => ({
      option,
      count: surveys.filter((s) => s.comparedToInstructor === option).length,
    })),
    helpful: surveys.map((s) => s.helpfulText.trim()).filter(Boolean),
    unhelpful: surveys.map((s) => s.unhelpfulText.trim()).filter(Boolean),
  };

  // ---------- Students vs experts ----------
  const comparable = inSurvey.filter((q) => q.expertVerdict !== null && q.students && q.students.rated > 0);
  const group = (qs: QuestionResult[]) => ({
    questions: qs.length,
    perceivedAccuracy: mean(qs.map((q) => q.students!.perceivedAccuracy).filter((v): v is number => v !== null)),
    flaggedPct: mean(qs.map((q) => q.students!.flaggedPct).filter((v): v is number => v !== null)),
    correctPct: mean(qs.map((q) => q.students!.correctPct).filter((v): v is number => v !== null)),
    usefulness: mean(qs.map((q) => q.students!.usefulness).filter((v): v is number => v !== null)),
  });
  const pairs = (f: (q: QuestionResult) => number | null) =>
    comparable
      .map((q) => [q.expertScore, f(q)] as const)
      .filter((p): p is [number, number] => p[0] !== null && p[1] !== null);
  const expertClarity = (q: QuestionResult) =>
    mean(Object.values(q.reviews).filter((r): r is Review => r !== null).map((r) => r.clarity));

  const comparison = {
    n: comparable.length,
    accurate: group(comparable.filter((q) => q.expertVerdict === "accurate")),
    notAccurate: group(comparable.filter((q) => q.expertVerdict !== "accurate")),
    correlations: [
      {
        label: "Expert accuracy score vs students' perceived accuracy",
        expect: "positive if students can spot inaccurate questions",
        rho: spearman(pairs((q) => q.students!.perceivedAccuracy)),
        n: pairs((q) => q.students!.perceivedAccuracy).length,
      },
      {
        label: "Expert accuracy score vs students' error-flag rate",
        expect: "negative if students flag the inaccurate ones",
        rho: spearman(pairs((q) => q.students!.flaggedPct)),
        n: pairs((q) => q.students!.flaggedPct).length,
      },
      {
        label: "Expert clarity vs student clarity",
        expect: "positive if experts and students agree on wording",
        rho: spearman(
          comparable
            .map((q) => [expertClarity(q), q.students!.clarity] as const)
            .filter((p): p is [number, number] => p[0] !== null && p[1] !== null),
        ),
        n: comparable.filter((q) => q.students!.clarity !== null).length,
      },
    ],
    scatter: comparable
      .filter((q) => q.expertScore !== null && q.students!.perceivedAccuracy !== null)
      .map((q) => ({
        label: `Q${q.surveyNumber}`,
        expertScore: Math.round(q.expertScore! * 100),
        perceived: Number(q.students!.perceivedAccuracy!.toFixed(2)),
        verdict: q.expertVerdict!,
      })),
  };

  return {
    quiz: { id: String(quiz._id), title: quiz.title, isOpen: quiz.isOpen, lectureId: String(quiz.lectureId) },
    generation: {
      total: questions.length,
      removed: questions.filter((q) => q.removed).length,
      inSurvey: inSurvey.length,
      excerptMissing: questions.filter((q) => !q.excerptFound).length,
    },
    questions,
    perReviewer,
    consensus,
    agreement,
    errorTags,
    students,
    survey,
    comparison,
  };
}

export type Results = NonNullable<Awaited<ReturnType<typeof computeResults>>>;
