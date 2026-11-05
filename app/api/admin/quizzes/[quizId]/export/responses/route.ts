import { isAdmin, unauthorizedResponse } from "@/lib/admin";
import { csvResponse, toCsv } from "@/lib/csv";
import { buildResponsesCsvRows } from "@/lib/exports";

export async function GET(_req: Request, ctx: RouteContext<"/api/admin/quizzes/[quizId]/export/responses">) {
  if (!(await isAdmin())) return unauthorizedResponse();
  const { quizId } = await ctx.params;
  const data = await buildResponsesCsvRows(quizId);
  if (!data) return Response.json({ error: "Quiz not found" }, { status: 404 });
  return csvResponse(`quiz-${quizId}-responses.csv`, toCsv(data.headers, data.rows));
}
