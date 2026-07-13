import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, withErrorHandling } from "@/lib/errors";
import type { RunActionResponse } from "@/lib/types";
import { executionLatencyMs } from "@/lib/runner";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const CANCELABLE_STATUSES = new Set(["queued", "awaiting_approval"]);

export const POST = withErrorHandling(async (_req: NextRequest, { params }: RouteParams) => {
  const { id } = await params;
  const existing = await prisma.run.findUnique({ where: { id } });
  if (!existing) throw new ApiError("not_found", `Run ${id} not found`);
  if (!CANCELABLE_STATUSES.has(existing.status)) {
    throw new ApiError(
      "invalid_state",
      `Run ${id} cannot be canceled from status "${existing.status}" (only queued/awaiting_approval are cancelable)`
    );
  }

  const finishedAt = new Date();
  const run = await prisma.$transaction(async (tx) => {
    await tx.stepExecution.updateMany({
      where: { runId: id, status: { in: ["pending", "running", "awaiting_approval"] } },
      data: { status: "skipped" },
    });
    return tx.run.update({
      where: { id },
      data: {
        status: "canceled",
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
