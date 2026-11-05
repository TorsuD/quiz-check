import { cookies } from "next/headers";
import { isValidObjectId } from "mongoose";
import { PARTICIPANT_COOKIE } from "@/lib/constants";
import { connectDB } from "@/lib/db";
import { Participant, Quiz } from "@/lib/models";
import { getParticipantCookie, isDuplicateKeyError, jsonError } from "@/lib/participant";

export async function POST(request: Request, ctx: RouteContext<"/api/quiz/[quizId]/start">) {
  const { quizId } = await ctx.params;
  if (!isValidObjectId(quizId)) return jsonError("Quiz not found", 404);
  await connectDB();
  const quiz = await Quiz.findById(quizId).lean();
  if (!quiz) return jsonError("Quiz not found", 404);

  let participantId = await getParticipantCookie();
  const existing = participantId ? await Participant.findOne({ quizId, participantId }).lean() : null;
  if (existing) {
    return Response.json({ ok: true, resumed: true, completed: Boolean(existing.completedAt) });
  }
  if (!quiz.isOpen) return jsonError("This survey is closed and is not accepting new responses.", 403);

  if (!participantId) {
    participantId = crypto.randomUUID();
    (await cookies()).set(PARTICIPANT_COOKIE, participantId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 60, // 60 days
    });
  }
  try {
    await Participant.create({
      quizId,
      participantId,
      consentedAt: new Date(),
      userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    });
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err; // double tap on "start": already created
  }
  return Response.json({ ok: true, resumed: false, completed: false });
}
