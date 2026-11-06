import mongoose, { Schema, type Model, type Types } from "mongoose";
import { ERROR_TAGS, type ErrorTag } from "./constants";

/*
 * Data model. All collections have createdAt / updatedAt timestamps.
 * Interfaces are written out explicitly (instead of InferSchemaType) so they double as
 * documentation and keep TypeScript fast.
 */

const { ObjectId } = Schema.Types;

type Timestamps = { createdAt: Date; updatedAt: Date };

function model<T>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}

// ---------- Lecture ----------
export interface LectureDoc extends Timestamps {
  _id: Types.ObjectId;
  title: string;
  sourceType: "pdf" | "text";
  fileName: string | null;
  text: string;
}
const lectureSchema = new Schema<LectureDoc>(
  {
    title: { type: String, required: true, trim: true },
    sourceType: { type: String, enum: ["pdf", "text"], required: true },
    fileName: { type: String, default: null },
    text: { type: String, required: true },
  },
  { timestamps: true },
);
export const Lecture = model("Lecture", lectureSchema);

// ---------- Question ----------
export type Difficulty = "easy" | "medium" | "hard";
export interface QuestionDoc extends Timestamps {
  _id: Types.ObjectId;
  lectureId: Types.ObjectId;
  order: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  sourceExcerpt: string;
  /** True when the excerpt appears verbatim (ignoring whitespace/case) in the lecture text. */
  excerptFoundInText: boolean;
  difficulty: Difficulty;
  model: string;
  provider: string;
  generatedAt: Date;
  /** Removals are research data: questions are never hard-deleted. */
  removedBeforeSurvey: boolean;
  removalReason: string | null;
  removedAt: Date | null;
}
const questionSchema = new Schema<QuestionDoc>(
  {
    lectureId: { type: ObjectId, ref: "Lecture", required: true, index: true },
    order: { type: Number, required: true },
    question: { type: String, required: true },
    options: { type: [String], required: true },
    correctIndex: { type: Number, required: true, min: 0, max: 3 },
    explanation: { type: String, required: true },
    sourceExcerpt: { type: String, required: true },
    excerptFoundInText: { type: Boolean, default: false },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
    model: { type: String, required: true },
    provider: { type: String, required: true },
    generatedAt: { type: Date, required: true },
    removedBeforeSurvey: { type: Boolean, default: false, index: true },
    removalReason: { type: String, default: null },
    removedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
export const Question = model("Question", questionSchema);

// ---------- Quiz ----------
export interface QuizDoc extends Timestamps {
  _id: Types.ObjectId;
  lectureId: Types.ObjectId;
  title: string;
  /** Snapshot of the questions (in order) at publish time. */
  questionIds: Types.ObjectId[];
  isOpen: boolean;
  publishedAt: Date;
}
const quizSchema = new Schema<QuizDoc>(
  {
    lectureId: { type: ObjectId, ref: "Lecture", required: true, index: true },
    title: { type: String, required: true },
    questionIds: [{ type: ObjectId, ref: "Question" }],
    isOpen: { type: Boolean, default: true },
    publishedAt: { type: Date, required: true },
  },
  { timestamps: true },
);
export const Quiz = model("Quiz", quizSchema);

// ---------- Participant ----------
export interface ParticipantDoc extends Timestamps {
  _id: Types.ObjectId;
  quizId: Types.ObjectId;
  /** Anonymous UUID stored in the student's cookie. */
  participantId: string;
  consentedAt: Date;
  completedAt: Date | null;
  userAgent: string | null;
}
const participantSchema = new Schema<ParticipantDoc>(
  {
    quizId: { type: ObjectId, ref: "Quiz", required: true, index: true },
    participantId: { type: String, required: true },
    consentedAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: true },
);
participantSchema.index({ quizId: 1, participantId: 1 }, { unique: true });
export const Participant = model("Participant", participantSchema);

// ---------- QuestionResponse ----------
export interface QuestionResponseDoc extends Timestamps {
  _id: Types.ObjectId;
  quizId: Types.ObjectId;
  questionId: Types.ObjectId;
  participantId: string;
  selectedIndex: number;
  isCorrect: boolean;
  answeredAt: Date;
  clarity: number | null;
  difficulty: number | null;
  usefulness: number | null;
  perceivedAccuracy: number | null;
  flaggedError: boolean;
  ratedAt: Date | null;
}
const rating = { type: Number, min: 1, max: 5, default: null };
const questionResponseSchema = new Schema<QuestionResponseDoc>(
  {
    quizId: { type: ObjectId, ref: "Quiz", required: true, index: true },
    questionId: { type: ObjectId, ref: "Question", required: true },
    participantId: { type: String, required: true },
    selectedIndex: { type: Number, required: true, min: 0, max: 3 },
    isCorrect: { type: Boolean, required: true },
    answeredAt: { type: Date, required: true },
    clarity: rating,
    difficulty: rating,
    usefulness: rating,
    perceivedAccuracy: rating,
    flaggedError: { type: Boolean, default: false },
    ratedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
questionResponseSchema.index({ quizId: 1, participantId: 1, questionId: 1 }, { unique: true });
export const QuestionResponse = model("QuestionResponse", questionResponseSchema);

// ---------- SurveyResponse ----------
export const COMPARISON_OPTIONS = ["much worse", "worse", "about the same", "better", "much better"] as const;
export type Comparison = (typeof COMPARISON_OPTIONS)[number];
export interface SurveyResponseDoc extends Timestamps {
  _id: Types.ObjectId;
  quizId: Types.ObjectId;
  participantId: string;
  wouldUse: number;
  comparedToInstructor: Comparison;
  examHelp: number;
  helpfulText: string;
  unhelpfulText: string;
}
const surveyResponseSchema = new Schema<SurveyResponseDoc>(
  {
    quizId: { type: ObjectId, ref: "Quiz", required: true, index: true },
    participantId: { type: String, required: true },
    wouldUse: { type: Number, min: 1, max: 5, required: true },
    comparedToInstructor: { type: String, enum: COMPARISON_OPTIONS, required: true },
    examHelp: { type: Number, min: 1, max: 5, required: true },
    helpfulText: { type: String, default: "" },
    unhelpfulText: { type: String, default: "" },
  },
  { timestamps: true },
);
surveyResponseSchema.index({ quizId: 1, participantId: 1 }, { unique: true });
export const SurveyResponse = model("SurveyResponse", surveyResponseSchema);

// ---------- ExpertReview (used in Phase 2) ----------
// The tag list lives in lib/constants.ts so client components can use it without importing mongoose.
export { ERROR_TAGS, type ErrorTag };
export interface ExpertReviewDoc extends Timestamps {
  _id: Types.ObjectId;
  quizId: Types.ObjectId;
  questionId: Types.ObjectId;
  reviewer: string;
  factuallyCorrect: "yes" | "partially" | "no";
  answerKeyCorrect: "yes" | "no";
  relevance: number;
  clarity: number;
  errorTags: ErrorTag[];
  otherNote: string;
}
const expertReviewSchema = new Schema<ExpertReviewDoc>(
  {
    quizId: { type: ObjectId, ref: "Quiz", required: true, index: true },
    questionId: { type: ObjectId, ref: "Question", required: true },
    reviewer: { type: String, required: true },
    factuallyCorrect: { type: String, enum: ["yes", "partially", "no"], required: true },
    answerKeyCorrect: { type: String, enum: ["yes", "no"], required: true },
    relevance: { type: Number, min: 1, max: 5, required: true },
    clarity: { type: Number, min: 1, max: 5, required: true },
    errorTags: [{ type: String, enum: ERROR_TAGS }],
    otherNote: { type: String, default: "" },
  },
  { timestamps: true },
);
expertReviewSchema.index({ questionId: 1, reviewer: 1 }, { unique: true });
export const ExpertReview = model("ExpertReview", expertReviewSchema);
