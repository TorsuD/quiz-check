"use server";

import { isValidObjectId } from "mongoose";
import { refresh } from "next/cache";
import { z } from "zod";
import { REVIEWERS } from "@/config/reviewers";
import { requireAdmin } from "@/lib/admin";
import { connectDB } from "@/lib/db";
import { ERROR_TAGS, ExpertReview, Question, Quiz } from "@/lib/models";

const objectId = z.string().refine(isValidObjectId, "Invalid id");

const reviewInput = z
  .object({
    quizId: objectId,
    questionId: objectId,
    reviewer: z.enum(REVIEWERS.map((r) => r.id) as [string, ...string[]]),
    factuallyCorrect: z.enum(["yes", "partially", "no"]),
    answerKeyCorrect: z.enum(["yes", "no"]),
    relevance: z.number().int().min(1).max(5),
    clarity: z.number().int().min(1).max(5),
    errorTags: z.array(z.enum(ERROR_TAGS)).max(ERROR_TAGS.length),
    otherNote: z.string().max(2000),
  })
  .refine((v) => !v.errorTags.includes("other") || v.otherNote.trim().length > 0, {
    message: "Describe the problem in the note when you tag it as “other”.",
    path: ["otherNote"],
  });

export type ReviewInput = z.input<typeof reviewInput>;
export type SaveReviewResult = { ok: true; savedAt: string } | { ok: false; error: string };

/** Creates or updates one reviewer's scores for one question. */
export async function saveExpertReview(input: ReviewInput): Promise<SaveReviewResult> {
  await requireAdmin();
  const parsed = reviewInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please complete every field." };
  const v = parsed.data;

  await connectDB();
  const [quiz, question] = await Promise.all([
    Quiz.findById(v.quizId, { lectureId: 1 }).lean(),
    Question.findById(v.questionId, { lectureId: 1 }).lean(),
  ]);
  // Reviews cover every question generated for the quiz's lecture, including removed ones.
  if (!quiz || !question || String(question.lectureId) !== String(quiz.lectureId)) {
    return { ok: false, error: "This question does not belong to this survey." };
  }

  const doc = await ExpertReview.findOneAndUpdate(
    { questionId: v.questionId, reviewer: v.reviewer },
    {
      quizId: v.quizId,
      questionId: v.questionId,
      reviewer: v.reviewer,
      factuallyCorrect: v.factuallyCorrect,
      answerKeyCorrect: v.answerKeyCorrect,
      relevance: v.relevance,
      clarity: v.clarity,
      errorTags: [...new Set(v.errorTags)],
      otherNote: v.otherNote.trim(),
    },
    { upsert: true, returnDocument: "after", runValidators: true },
  ).lean();

  refresh(); // updates the "x of n reviewed" counter on the page
  return { ok: true, savedAt: (doc?.updatedAt ?? new Date()).toISOString() };
}
