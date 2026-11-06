"use server";

import { isValidObjectId, type Types } from "mongoose";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { connectDB } from "@/lib/db";
import { ExpertReview, Lecture, Participant, Question, QuestionResponse, Quiz, SurveyResponse } from "@/lib/models";

type ActionResult = { error: string } | undefined;

async function lectureHasQuiz(lectureId: Types.ObjectId) {
  return Boolean(await Quiz.exists({ lectureId }));
}

/** Soft-delete: the question stays in the database flagged removedBeforeSurvey. */
export async function removeQuestion(questionId: string, reason: string): Promise<ActionResult> {
  await requireAdmin();
  const trimmed = reason.trim();
  if (!trimmed) return { error: "Please give a reason for removing this question." };
  if (!isValidObjectId(questionId)) return { error: "Question not found." };
  await connectDB();
  const q = await Question.findById(questionId);
  if (!q) return { error: "Question not found." };
  if (await lectureHasQuiz(q.lectureId)) return { error: "This set is already published; questions can no longer be removed." };
  q.removedBeforeSurvey = true;
  q.removalReason = trimmed.slice(0, 1000);
  q.removedAt = new Date();
  await q.save();
  refresh();
}

export async function restoreQuestion(questionId: string): Promise<ActionResult> {
  await requireAdmin();
  if (!isValidObjectId(questionId)) return { error: "Question not found." };
  await connectDB();
  const q = await Question.findById(questionId);
  if (!q) return { error: "Question not found." };
  if (await lectureHasQuiz(q.lectureId)) return { error: "This set is already published." };
  q.removedBeforeSurvey = false;
  q.removalReason = null;
  q.removedAt = null;
  await q.save();
  refresh();
}

export async function publishQuiz(lectureId: string): Promise<ActionResult> {
  await requireAdmin();
  if (!isValidObjectId(lectureId)) return { error: "Lecture not found." };
  await connectDB();
  const lecture = await Lecture.findById(lectureId).lean();
  if (!lecture) return { error: "Lecture not found." };
  const existing = await Quiz.findOne({ lectureId }).lean();
  if (existing) redirect(`/admin/quiz/${existing._id}`);
  const active = await Question.find({ lectureId, removedBeforeSurvey: false }).sort({ order: 1 }).lean();
  if (active.length === 0) return { error: "There are no questions left to publish." };
  const quiz = await Quiz.create({
    lectureId,
    title: lecture.title,
    questionIds: active.map((q) => q._id),
    isOpen: true,
    publishedAt: new Date(),
  });
  redirect(`/admin/quiz/${quiz._id}`);
}

export async function setQuizOpen(quizId: string, open: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (!isValidObjectId(quizId)) return { error: "Quiz not found." };
  await connectDB();
  const res = await Quiz.updateOne({ _id: quizId }, { $set: { isOpen: open } });
  if (res.matchedCount === 0) return { error: "Quiz not found." };
  refresh();
}

/**
 * Hard delete: removes the lecture and everything that hangs off it (questions, the published
 * survey, student answers, final-survey responses and expert reviews). This cannot be undone,
 * so the admin must type the lecture title to confirm.
 */
export async function deleteLecture(lectureId: string, confirmTitle: string): Promise<ActionResult> {
  await requireAdmin();
  if (!isValidObjectId(lectureId)) return { error: "Lecture not found." };
  await connectDB();
  const lecture = await Lecture.findById(lectureId, { title: 1 }).lean();
  if (!lecture) return { error: "Lecture not found." };
  if (confirmTitle.trim() !== lecture.title.trim()) return { error: "The title you typed doesn't match." };

  const quizIds = (await Quiz.find({ lectureId }, { _id: 1 }).lean()).map((q) => q._id);
  const byQuiz = { quizId: { $in: quizIds } };
  await Promise.all([
    QuestionResponse.deleteMany(byQuiz),
    SurveyResponse.deleteMany(byQuiz),
    ExpertReview.deleteMany(byQuiz),
    Participant.deleteMany(byQuiz),
  ]);
  await Promise.all([Quiz.deleteMany({ lectureId }), Question.deleteMany({ lectureId })]);
  await Lecture.deleteOne({ _id: lectureId });
  redirect("/admin");
}
