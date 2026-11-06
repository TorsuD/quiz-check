export const CONSENT_TEXT =
  "This survey is anonymous and voluntary. Your responses will be used only for a COMP-5112 course research project. You may stop at any time. Do not enter your name or student ID.";

export const PARTICIPANT_COOKIE = "qc_pid";

export const LETTERS = ["A", "B", "C", "D"] as const;

export type RatingKey = "clarity" | "difficulty" | "usefulness" | "perceivedAccuracy";

export const RATING_SCALES: { key: RatingKey; label: string; low: string; high: string }[] = [
  { key: "clarity", label: "Clarity", low: "Very unclear", high: "Very clear" },
  { key: "difficulty", label: "Difficulty", low: "Very easy", high: "Very hard" },
  { key: "usefulness", label: "Usefulness for studying", low: "Not useful", high: "Very useful" },
  { key: "perceivedAccuracy", label: "Accuracy (as you perceive it)", low: "Seems wrong", high: "Seems fully correct" },
];

export const SURVEY = {
  wouldUse: "Would you use AI-generated practice questions to study?",
  comparedToInstructor: "Compared to instructor-made practice questions, these were...",
  examHelp: "Overall, how much would questions like these help you prepare for exams?",
  helpfulText: "What made a question helpful?",
  unhelpfulText: "What made a question unhelpful or confusing?",
} as const;

/** Problem categories an expert reviewer can tag on a question (Phase 2). */
export const ERROR_TAGS = [
  "hallucination",
  "wrong answer key",
  "ambiguous wording",
  "multiple correct options",
  "too trivial",
  "off-topic",
  "other",
] as const;
export type ErrorTag = (typeof ERROR_TAGS)[number];
