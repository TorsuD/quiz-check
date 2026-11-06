import { isAdmin, unauthorizedResponse } from "@/lib/admin";
import { csvResponse, toCsv } from "@/lib/csv";
import { buildFullCsvRows } from "@/lib/exports";

/** One row per generated question: expert scores, agreement and student aggregates. */
export async function GET(_req: Request, ctx: RouteContext<"/api/admin/quizzes/[quizId]/export/full">) {
  if (!(await isAdmin())) return unauthorizedResponse();
  const { quizId } = await ctx.params;
  const data = await buildFullCsvRows(quizId);
  if (!data) return Response.json({ error: "Quiz not found" }, { status: 404 });
  return csvResponse(`quiz-${quizId}-full-results.csv`, toCsv(data.headers, data.rows));
}
