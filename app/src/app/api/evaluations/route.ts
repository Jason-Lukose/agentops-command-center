import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withErrorHandling, zodErrorResponse } from "@/lib/errors";
import { evaluationListQuerySchema } from "@/lib/validation/schemas";
import type { EvaluationListResponse } from "@/lib/types";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = evaluationListQuerySchema.safeParse(searchParams);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { workflowId, runId, evaluatorType, limit } = parsed.data;

  const evaluations = await prisma.evaluationResult.findMany({
    where: {
      ...(runId ? { runId } : {}),
      ...(evaluatorType ? { evaluatorType } : {}),
      ...(workflowId ? { run: { workflowId } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const body: EvaluationListResponse = { evaluations };
  return NextResponse.json(body);
});
