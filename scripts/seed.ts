/**
 * Inserts a sample lecture, five questions (one pre-removed, to show the soft-delete flow),
 * and an open published quiz, so the UI can be tested without calling the LLM.
 *
 *   npm run seed
 *   npm run seed -- --with-results   # also adds sample expert reviews and student responses
 *
 * Re-running replaces the previous sample (only documents belonging to the sample lecture).
 */
import mongoose from "mongoose";
import { connectDB } from "../lib/db";
import { excerptAppearsIn } from "../lib/text";
import { ExpertReview, Lecture, Participant, Question, QuestionResponse, Quiz, SurveyResponse } from "../lib/models";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // file not present
  }
}

const SAMPLE_TITLE = "[Sample] Database Normalization";

const LECTURE_TEXT = `Database Normalization

Normalization is the process of organizing the columns and tables of a relational database to reduce data redundancy and improve data integrity. It was first proposed by Edgar F. Codd as part of his relational model.

Anomalies
Poorly designed tables suffer from three kinds of anomalies. An update anomaly occurs when the same fact is stored in several rows and only some of them are changed. An insertion anomaly occurs when a fact cannot be recorded without also recording an unrelated fact. A deletion anomaly occurs when deleting one fact unintentionally removes another fact.

First Normal Form (1NF)
A table is in first normal form if every column contains only atomic values and there are no repeating groups. For example, a column that stores several phone numbers separated by commas violates 1NF.

Functional Dependencies
A functional dependency X -> Y means that the value of X uniquely determines the value of Y. Keys are defined in terms of functional dependencies: a candidate key is a minimal set of attributes that functionally determines every other attribute in the table.

Second Normal Form (2NF)
A table is in second normal form if it is in 1NF and every non-key attribute depends on the whole of every candidate key. Partial dependencies, where a non-key attribute depends on only part of a composite key, violate 2NF.

Third Normal Form (3NF)
A table is in third normal form if it is in 2NF and no non-key attribute is transitively dependent on a candidate key. In other words, non-key attributes must depend on the key, the whole key, and nothing but the key.

Boyce-Codd Normal Form (BCNF)
BCNF is a stricter version of 3NF. A table is in BCNF if, for every non-trivial functional dependency X -> Y, X is a superkey.

Trade-offs
Higher normal forms reduce redundancy but usually require more joins when querying. Some systems, such as data warehouses, deliberately denormalize tables to improve read performance.`;

const QUESTIONS = [
  {
    question: "What is the main purpose of database normalization?",
    options: [
      "To reduce data redundancy and improve data integrity",
      "To make every query run without joins",
      "To encrypt sensitive columns",
      "To increase the number of tables as much as possible",
    ],
    correctIndex: 0,
    explanation: "The notes define normalization as organizing tables to reduce data redundancy and improve data integrity.",
    sourceExcerpt:
      "Normalization is the process of organizing the columns and tables of a relational database to reduce data redundancy and improve data integrity.",
    difficulty: "easy",
  },
  {
    question: "A table stores several phone numbers in one column, separated by commas. Which normal form does it violate?",
    options: ["First normal form", "Second normal form", "Third normal form", "BCNF only"],
    correctIndex: 0,
    explanation: "1NF requires atomic values, and the notes give comma-separated phone numbers as an example of a 1NF violation.",
    sourceExcerpt: "For example, a column that stores several phone numbers separated by commas violates 1NF.",
    difficulty: "easy",
  },
  {
    question: "Deleting the last order for a product also removes the only record of that product's price. What kind of anomaly is this?",
    options: ["Update anomaly", "Insertion anomaly", "Deletion anomaly", "Transitive anomaly"],
    correctIndex: 2,
    explanation: "A deletion anomaly is when deleting one fact unintentionally removes another fact.",
    sourceExcerpt: "A deletion anomaly occurs when deleting one fact unintentionally removes another fact.",
    difficulty: "medium",
  },
  {
    question: "A table is in 2NF but a non-key attribute depends on another non-key attribute. Which normal form is violated?",
    options: ["1NF", "3NF", "2NF", "None, the table is fully normalized"],
    correctIndex: 1,
    explanation: "A dependency through another non-key attribute is a transitive dependency, which 3NF forbids.",
    sourceExcerpt:
      "A table is in third normal form if it is in 2NF and no non-key attribute is transitively dependent on a candidate key.",
    difficulty: "hard",
  },
  {
    // Deliberately wrong answer key, pre-removed to demonstrate the soft-delete record.
    question: "Who first proposed normalization?",
    options: ["Edgar F. Codd", "Peter Chen", "Donald Knuth", "Raymond Boyce"],
    correctIndex: 3,
    explanation: "Normalization was proposed as part of the relational model.",
    sourceExcerpt: "It was first proposed by Edgar F. Codd as part of his relational model.",
    difficulty: "easy",
    removed: "Wrong answer key: the notes say Codd, not Boyce.",
  },
] as const;

async function main() {
  await connectDB();

  const old = await Lecture.find({ title: SAMPLE_TITLE }).lean();
  if (old.length) {
    const oldIds = old.map((l) => l._id);
    const quizIds = (await Quiz.find({ lectureId: { $in: oldIds } }).lean()).map((q) => q._id);
    await Promise.all([
      Participant.deleteMany({ quizId: { $in: quizIds } }),
      QuestionResponse.deleteMany({ quizId: { $in: quizIds } }),
      SurveyResponse.deleteMany({ quizId: { $in: quizIds } }),
      ExpertReview.deleteMany({ quizId: { $in: quizIds } }),
      Quiz.deleteMany({ _id: { $in: quizIds } }),
      Question.deleteMany({ lectureId: { $in: oldIds } }),
      Lecture.deleteMany({ _id: { $in: oldIds } }),
    ]);
    console.log("Removed previous sample data.");
  }

  const lecture = await Lecture.create({ title: SAMPLE_TITLE, sourceType: "text", fileName: null, text: LECTURE_TEXT });
  const generatedAt = new Date();
  const questions = await Question.insertMany(
    QUESTIONS.map((q, i) => ({
      lectureId: lecture._id,
      order: i + 1,
      question: q.question,
      options: [...q.options],
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      sourceExcerpt: q.sourceExcerpt,
      excerptFoundInText: excerptAppearsIn(q.sourceExcerpt, LECTURE_TEXT),
      difficulty: q.difficulty,
      model: "seed-data",
      provider: "seed",
      generatedAt,
      ...("removed" in q ? { removedBeforeSurvey: true, removalReason: q.removed, removedAt: generatedAt } : {}),
    })),
  );
  const quiz = await Quiz.create({
    lectureId: lecture._id,
    title: SAMPLE_TITLE,
    questionIds: questions.filter((q) => !q.removedBeforeSurvey).map((q) => q._id),
    isOpen: true,
    publishedAt: new Date(),
  });

  if (process.argv.includes("--with-results")) {
    await seedResults(quiz._id, questions.map((q) => q._id));
    console.log("Added sample expert reviews, 8 student attempts and 6 final surveys.");
  }

  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  console.log(`Seeded lecture ${lecture._id} with ${questions.length} questions (1 removed).`);
  console.log(`Student quiz: ${base}/quiz/${quiz._id}`);
  console.log(`Admin view:   ${base}/admin/quiz/${quiz._id}`);
  console.log(`Results:      ${base}/admin/results/${quiz._id}`);
}

/**
 * Fake but plausible data so the results dashboard can be explored before a real class.
 * Reviewer A and B disagree on question 4 on purpose, to show the disagreement list.
 */
async function seedResults(quizId: mongoose.Types.ObjectId, questionIds: mongoose.Types.ObjectId[]) {
  type R = [factual: "yes" | "partially" | "no", key: "yes" | "no", relevance: number, clarity: number, tags: string[], note: string];
  const reviews: Record<"A" | "B", R[]> = {
    A: [
      ["yes", "yes", 5, 5, [], ""],
      ["yes", "yes", 5, 4, [], ""],
      ["yes", "yes", 4, 4, [], ""],
      ["partially", "yes", 4, 3, ["ambiguous wording"], "“Depends on another non-key attribute” could also describe a partial dependency."],
      ["yes", "no", 3, 5, ["wrong answer key"], "Notes say Codd; key marks Boyce."],
    ],
    B: [
      ["yes", "yes", 5, 5, [], ""],
      ["yes", "yes", 5, 5, [], ""],
      ["yes", "yes", 5, 4, [], ""],
      ["yes", "yes", 4, 4, [], ""],
      ["yes", "no", 2, 4, ["wrong answer key", "too trivial"], ""],
    ],
  };
  await ExpertReview.insertMany(
    (["A", "B"] as const).flatMap((reviewer) =>
      reviews[reviewer].map(([factuallyCorrect, answerKeyCorrect, relevance, clarity, errorTags, otherNote], i) => ({
        quizId,
        questionId: questionIds[i],
        reviewer,
        factuallyCorrect,
        answerKeyCorrect,
        relevance,
        clarity,
        errorTags,
        otherNote,
      })),
    ),
  );

  const SAMPLE_ERROR_NOTES = [
    "I think option B could also be correct.",
    "The notes don't say this exactly.",
    "",
  ].map((n) => n || null);

  // Students: [selected option per survey question] and [clarity, difficulty, usefulness, perceivedAccuracy, flagged]
  const surveyQs = questionIds.slice(0, 4);
  const correct = QUESTIONS.slice(0, 4).map((q) => q.correctIndex);
  const picks = [
    [0, 0, 2, 1], [0, 0, 2, 2], [0, 0, 0, 1], [0, 1, 2, 2],
    [0, 0, 2, 1], [1, 0, 2, 0], [0, 0, 1, 1], [0, 0, 2, 2],
  ];
  const ratings: [number, number, number, number, boolean][][] = picks.map((_, s) => [
    [5, 1 + (s % 2), 4 + (s % 2), 5, false],
    [5, 2, 4, 5, false],
    [4, 3, 5, 4, s === 3],
    [3 - (s % 2), 4, 3 + (s % 2), 3 - (s % 3 === 0 ? 1 : 0), s % 3 === 0],
  ]);
  const now = Date.now();
  for (let s = 0; s < picks.length; s++) {
    const participantId = `sample-student-${s + 1}`;
    const completed = s < 6;
    const consentedAt = new Date(now - (60 - s * 5) * 60_000);
    await Participant.create({ quizId, participantId, consentedAt, completedAt: completed ? new Date(consentedAt.getTime() + 9 * 60_000) : null, userAgent: "seed" });
    const answered = completed ? 4 : 2 + (s % 2);
    await QuestionResponse.insertMany(
      surveyQs.slice(0, answered).map((questionId, i) => {
        const [clarity, difficulty, usefulness, perceivedAccuracy, flaggedError] = ratings[s][i];
        const at = new Date(consentedAt.getTime() + (i + 1) * 2 * 60_000);
        return {
          quizId, questionId, participantId,
          selectedIndex: picks[s][i], isCorrect: picks[s][i] === correct[i], answeredAt: at,
          clarity, difficulty, usefulness, perceivedAccuracy, flaggedError, ratedAt: at,
          errorNote: flaggedError ? SAMPLE_ERROR_NOTES[(s + i) % SAMPLE_ERROR_NOTES.length] : null,
        };
      }),
    );
    if (completed) {
      const texts = [
        ["The explanations quoted the notes directly.", ""],
        ["Short and to the point.", "Question 4 was worded confusingly."],
        ["Good mix of easy and hard.", ""],
        ["", "Some options were obviously wrong."],
        ["Felt like real exam questions.", "The last one could have two answers."],
        ["Instant feedback helped.", ""],
      ][s];
      await SurveyResponse.create({
        quizId, participantId,
        wouldUse: [5, 4, 4, 3, 5, 4][s],
        comparedToInstructor: (["about the same", "worse", "better", "about the same", "better", "about the same"] as const)[s],
        examHelp: [4, 3, 4, 3, 5, 4][s],
        helpfulText: texts[0], unhelpfulText: texts[1],
      });
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
