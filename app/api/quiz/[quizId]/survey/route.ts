import { z } from "zod";
import { COMPARISON_OPTIONS, Participant, SurveyResponse } from "@/lib/models";
import { jsonError, requireParticipant } from "@/lib/participant";

const score = z.number().int().min(1).max(5);
const Body = z.object({
  wouldUse: score,
  comparedToInstructor: z.enum(COMPARISON_OPTIONS),
  examHelp: score,
  helpfulText: z.string().max(3000).default(""),
  unhelpfulText: z.string().max(3000).default(""),
});

export async function POST(request: Request, ctx: RouteContext<"/api/quiz/[quizId]/survey">) {
  const { quizId } = await ctx.params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Please answer the three required questions.");
  const auth = await requireParticipant(quizId);
  if ("error" in auth) return auth.error;
  const { participantId } = auth;

  await SurveyResponse.updateOne(
    { quizId, participantId },
    { $set: { ...parsed.data, helpfulText: parsed.data.helpfulText.trim(), unhelpfulText: parsed.data.unhelpfulText.trim() } },
    { upsert: true },
  );
  await Participant.updateOne({ quizId, participantId, completedAt: null }, { $set: { completedAt: new Date() } });
  return Response.json({ ok: true });
}
