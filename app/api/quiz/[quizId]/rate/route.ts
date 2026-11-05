import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { QuestionResponse } from "@/lib/models";
import { jsonError, requireParticipant } from "@/lib/participant";

const score = z.number().int().min(1).max(5);
const Body = z.object({
  questionId: z.string().refine(isValidObjectId),
  clarity: score,
  difficulty: score,
  usefulness: score,
  perceivedAccuracy: score,
  flaggedError: z.boolean(),
});

export async function POST(request: Request, ctx: RouteContext<"/api/quiz/[quizId]/rate">) {
  const { quizId } = await ctx.params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Please answer all four rating scales.");
  const auth = await requireParticipant(quizId);
  if ("error" in auth) return auth.error;

  const { questionId, ...ratings } = parsed.data;
  const updated = await QuestionResponse.findOneAndUpdate(
    { quizId, participantId: auth.participantId, questionId },
    { $set: { ...ratings, ratedAt: new Date() } },
    { returnDocument: "after" },
  ).lean();
  if (!updated) return jsonError("Answer the question before rating it.", 409);
  return Response.json({ ok: true });
}
