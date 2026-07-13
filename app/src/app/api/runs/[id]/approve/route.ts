import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, withErrorHandling, zodErrorResponse } from "@/lib/errors";
import { approvalActionSchema } from "@/lib/validation/schemas";
import { enqueueRun } from "@/lib/queue";
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

  const run = await prisma.$transaction(async (tx) => {
    await tx.stepExecution.update({
      where: { id: pendingStep.id },
      data: {
        status: "succeeded",
        output: { decision: "approved", note: note ?? null },
        approvalDecidedAt: new Date(),
      },
    });
    return tx.run.update({ where: { id }, data: { status: "queued" } });
  });

  try {
    await enqueueRun(id);
  } catch (err) {
    console.error(`Failed to re-enqueue run ${id} after approval:`, err);
    throw new ApiError("internal_error", "Run approved but failed to re-enqueue for execution");
  }

  const body: RunActionResponse = { run };
  return NextResponse.json(body);
});
