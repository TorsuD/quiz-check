import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { Question, QuestionResponse } from "@/lib/models";
import { isDuplicateKeyError, jsonError, requireParticipant } from "@/lib/participant";

const Body = z.object({
  questionId: z.string().refine(isValidObjectId),
  selectedIndex: z.number().int().min(0).max(3),
});

/**
 * Records the student's answer and reveals correctness + explanation.
 * The first answer is final: re-submitting returns the original result unchanged.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/quiz/[quizId]/answer">) {
  const { quizId } = await ctx.params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid answer.");
  const auth = await requireParticipant(quizId);
  if ("error" in auth) return auth.error;
  const { quiz, participantId } = auth;
  const { questionId, selectedIndex } = parsed.data;

  if (!quiz.questionIds.some((id) => String(id) === questionId)) return jsonError("Question not in this quiz.", 404);
  const question = await Question.findById(questionId).lean();
  if (!question) return jsonError("Question not found.", 404);

  const reveal = (r: { selectedIndex: number; isCorrect: boolean }) =>
    Response.json({
      selectedIndex: r.selectedIndex,
      isCorrect: r.isCorrect,
      correctIndex: question.correctIndex,
      explanation: question.explanation,
    });

  const existing = await QuestionResponse.findOne({ quizId, participantId, questionId }).lean();
  if (existing) return reveal(existing);

  try {
    const created = await QuestionResponse.create({
      quizId,
      questionId,
      participantId,
      selectedIndex,
      isCorrect: selectedIndex === question.correctIndex,
      answeredAt: new Date(),
    });
    return reveal(created);
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    const again = await QuestionResponse.findOne({ quizId, participantId, questionId }).lean();
    return again ? reveal(again) : jsonError("Could not save answer.", 500);
  }
}
