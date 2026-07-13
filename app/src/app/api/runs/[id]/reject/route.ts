import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, withErrorHandling, zodErrorResponse } from "@/lib/errors";
import { approvalActionSchema } from "@/lib/validation/schemas";
import { executionLatencyMs } from "@/lib/runner";
import type { RunActionResponse } from "@/lib/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const POST = withErrorHandling(async (req: NextRequest, { params }: RouteParams) => {
  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = approvalActionSchema.safeParse(json);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { note } = parsed.data;

  const existing = await prisma.run.findUnique({ where: { id } });
  if (!existing) throw new ApiError("not_found", `Run ${id} not found`);
  if (existing.status !== "awaiting_approval") {
    throw new ApiError("invalid_state", `Run ${id} is not awaiting approval (status: ${existing.status})`);
  }

  const pendingStep = await prisma.stepExecution.findFirst({
    where: { runId: id, status: "awaiting_approval" },
  });
  if (!pendingStep) {
    throw new ApiError(
      "invalid_state",
      `Run ${id} is awaiting_approval but has no pending approval step execution`
    );
  }

  const errorMessage = `Approval rejected${note ? `: ${note}` : ""}`;
  const finishedAt = new Date();

  const run = await prisma.$transaction(async (tx) => {
    await tx.stepExecution.update({
      where: { id: pendingStep.id },
      data: {
        status: "failed",
        output: { decision: "rejected", note: note ?? null },
        errorMessage: "Rejected by reviewer",
        approvalDecidedAt: finishedAt,
      },
    });
    await tx.stepExecution.updateMany({
      where: { runId: id, position: { gt: pendingStep.position } },
      data: { status: "skipped" },
    });
    return tx.run.update({
      where: { id },
      data: {
        status: "failed",
        errorMessage,
        finishedAt,
        // Execution time only (sum of step latencies) — consistent with the
        // runner's semantics so dashboard avg(latencyMs) is apples-to-apples.
        latencyMs: await executionLatencyMs(tx, id),
      },
    });
  });

  const body: RunActionResponse = { run };
  return NextResponse.json(body);
});
