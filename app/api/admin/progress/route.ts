import { isAdmin, unauthorizedResponse } from "@/lib/admin";
import { connectDB } from "@/lib/db";
import { REVIEWERS } from "@/config/reviewers";
import { ExpertReview, Lecture, Participant, Question, Quiz } from "@/lib/models";

export type AdminProgress = {
  lectureCount: number;
  latestLecture: { id: string; title: string; kept: number; removed: number } | null;
  latestQuiz: {
    id: string;
    isOpen: boolean;
    started: number;
    completed: number;
    /** questions scored per reviewer, out of kept + removed */
    reviewed: { name: string; done: number }[];
  } | null;
};

/** Workflow progress for the sidebar's "How it works" tracker, based on the most recent question set. */
export async function GET() {
  if (!(await isAdmin())) return unauthorizedResponse();
  await connectDB();

  const [lectureCount, lecture] = await Promise.all([
    Lecture.countDocuments(),
    Lecture.findOne({}, { title: 1 }).sort({ createdAt: -1 }).lean(),
  ]);

  let latestLecture: AdminProgress["latestLecture"] = null;
  let latestQuiz: AdminProgress["latestQuiz"] = null;

  if (lecture) {
    const [kept, removed, quiz] = await Promise.all([
      Question.countDocuments({ lectureId: lecture._id, removedBeforeSurvey: false }),
      Question.countDocuments({ lectureId: lecture._id, removedBeforeSurvey: true }),
      Quiz.findOne({ lectureId: lecture._id }, { isOpen: 1 }).sort({ publishedAt: -1 }).lean(),
    ]);
    latestLecture = { id: String(lecture._id), title: lecture.title, kept, removed };

    if (quiz) {
      const [started, completed, ...reviewCounts] = await Promise.all([
        Participant.countDocuments({ quizId: quiz._id }),
        Participant.countDocuments({ quizId: quiz._id, completedAt: { $ne: null } }),
        ...REVIEWERS.map((r) => ExpertReview.countDocuments({ quizId: quiz._id, reviewer: r.id })),
      ]);
      latestQuiz = {
        id: String(quiz._id),
        isOpen: quiz.isOpen,
        started,
        completed,
        reviewed: REVIEWERS.map((r, i) => ({ name: r.name, done: reviewCounts[i] })),
      };
    }
  }

  return Response.json({ lectureCount, latestLecture, latestQuiz } satisfies AdminProgress, {
    headers: { "Cache-Control": "no-store" },
  });
}
