import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withErrorHandling, zodErrorResponse } from "@/lib/errors";
import { dashboardQuerySchema } from "@/lib/validation/schemas";
import type { DashboardResponse, EvaluatorType } from "@/lib/types";

const RECENT_RUNS_LIMIT = 10;
const EVALUATOR_TYPES: EvaluatorType[] = ["deterministic", "rubric", "llm_judge"];

export const GET = withErrorHandling(async (req: NextRequest) => {
  const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = dashboardQuerySchema.safeParse(searchParams);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { workflowId } = parsed.data;

  const runWhere = workflowId ? { workflowId } : {};

  const [statusCounts, latencyAgg, failedStepCount, recentRuns, evalAggregates] = await Promise.all([
    prisma.run.groupBy({ by: ["status"], where: runWhere, _count: { _all: true } }),
    prisma.run.aggregate({ where: { ...runWhere, latencyMs: { not: null } }, _avg: { latencyMs: true } }),
    prisma.stepExecution.count({
      where: { status: "failed", ...(workflowId ? { run: { workflowId } } : {}) },
    }),
    prisma.run.findMany({
      where: runWhere,
      orderBy: { createdAt: "desc" },
      take: RECENT_RUNS_LIMIT,
      select: { id: true, workflowId: true, status: true, latencyMs: true, createdAt: true },
    }),
    Promise.all(
      EVALUATOR_TYPES.map((evaluatorType) =>
        prisma.evaluationResult.aggregate({
          where: { evaluatorType, ...(workflowId ? { run: { workflowId } } : {}) },
          _avg: { score: true },
        })
      )
    ),
  ]);

  const totalRuns = statusCounts.reduce((sum, s) => sum + s._count._all, 0);
  const succeeded = statusCounts.find((s) => s.status === "succeeded")?._count._all ?? 0;
  const failed = statusCounts.find((s) => s.status === "failed")?._count._all ?? 0;
  // successRate = succeeded / (succeeded + failed). Canceled runs are
  // deliberately excluded from the denominator — a user cancellation is not
  // a failure of the workflow, so it should not lower the reported rate.
  const successDenominator = succeeded + failed;

  const body: DashboardResponse = {
    totals: {
      runs: totalRuns,
      succeeded,
      failed,
      successRate: successDenominator > 0 ? Math.round((succeeded / successDenominator) * 1000) / 1000 : 0,
    },
    avgLatencyMs: latencyAgg._avg.latencyMs !== null ? Math.round(latencyAgg._avg.latencyMs) : null,
    failedStepCount,
    recentRuns,
    evalScores: {
      deterministic: evalAggregates[0]._avg.score !== null ? Math.round(evalAggregates[0]._avg.score! * 1000) / 1000 : null,
      rubric: evalAggregates[1]._avg.score !== null ? Math.round(evalAggregates[1]._avg.score! * 1000) / 1000 : null,
      llm_judge: evalAggregates[2]._avg.score !== null ? Math.round(evalAggregates[2]._avg.score! * 1000) / 1000 : null,
    },
  };
  return NextResponse.json(body);
});
