import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, withErrorHandling } from "@/lib/errors";
import type { RunDetailResponse } from "@/lib/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const GET = withErrorHandling(async (_req: NextRequest, { params }: RouteParams) => {
  const { id } = await params;
  const run = await prisma.run.findUnique({ where: { id } });
  if (!run) throw new ApiError("not_found", `Run ${id} not found`);

  const [steps, evaluations] = await Promise.all([
    prisma.stepExecution.findMany({ where: { runId: id }, orderBy: { position: "asc" } }),
    prisma.evaluationResult.findMany({ where: { runId: id }, orderBy: { createdAt: "asc" } }),
  ]);

  const body: RunDetailResponse = { run, steps, evaluations };
  return NextResponse.json(body);
});
