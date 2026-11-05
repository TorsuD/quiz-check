import "server-only";
import { isValidObjectId } from "mongoose";
import { connectDB } from "./db";
import { Question, Quiz } from "./models";

/** Loads a quiz and its questions in published order. */
export async function loadQuizBundle(quizId: string) {
  if (!isValidObjectId(quizId)) return null;
  await connectDB();
  const quiz = await Quiz.findById(quizId).lean();
  if (!quiz) return null;
  const questionDocs = await Question.find({ _id: { $in: quiz.questionIds } }).lean();
  const byId = new Map(questionDocs.map((q) => [String(q._id), q]));
  const questions = quiz.questionIds
    .map((id) => byId.get(String(id)))
    .filter((q) => q !== undefined);
  return { quiz, questions };
}
