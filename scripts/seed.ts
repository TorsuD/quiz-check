/**
 * Inserts a sample lecture, five questions (one pre-removed, to show the soft-delete flow),
 * and an open published quiz, so the UI can be tested without calling the LLM.
 *
 *   npm run seed
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

  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  console.log(`Seeded lecture ${lecture._id} with ${questions.length} questions (1 removed).`);
  console.log(`Student quiz: ${base}/quiz/${quiz._id}`);
  console.log(`Admin view:   ${base}/admin/quiz/${quiz._id}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
