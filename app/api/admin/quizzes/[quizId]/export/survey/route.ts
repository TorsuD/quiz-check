import { isAdmin, unauthorizedResponse } from "@/lib/admin";
import { csvResponse, toCsv } from "@/lib/csv";
import { buildSurveyCsvRows } from "@/lib/exports";

export async function GET(_req: Request, ctx: RouteContext<"/api/admin/quizzes/[quizId]/export/survey">) {
  if (!(await isAdmin())) return unauthorizedResponse();
  const { quizId } = await ctx.params;
  const data = await buildSurveyCsvRows(quizId);
  if (!data) return Response.json({ error: "Quiz not found" }, { status: 404 });
  return csvResponse(`quiz-${quizId}-survey.csv`, toCsv(data.headers, data.rows));
}
