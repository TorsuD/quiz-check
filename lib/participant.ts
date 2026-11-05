import "server-only";
import { cookies } from "next/headers";
import { isValidObjectId } from "mongoose";
import { PARTICIPANT_COOKIE } from "./constants";
import { connectDB } from "./db";
import { Participant, Quiz } from "./models";

export async function getParticipantCookie(): Promise<string | null> {
  const value = (await cookies()).get(PARTICIPANT_COOKIE)?.value;
  return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

export function jsonError(error: string, status = 400) {
  return Response.json({ error }, { status });
}

/** Loads the quiz and the caller's Participant record, or returns an error Response. */
export async function requireParticipant(quizId: string) {
  if (!isValidObjectId(quizId)) return { error: jsonError("Quiz not found", 404) } as const;
  const participantId = await getParticipantCookie();
  if (!participantId) return { error: jsonError("Your session was not found. Please reload the page.", 401) } as const;
  await connectDB();
  const [quiz, participant] = await Promise.all([
    Quiz.findById(quizId).lean(),
    Participant.findOne({ quizId, participantId }).lean(),
  ]);
  if (!quiz) return { error: jsonError("Quiz not found", 404) } as const;
  if (!participant) return { error: jsonError("Please start the survey first.", 403) } as const;
  return { quiz, participant, participantId } as const;
}

export function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}
