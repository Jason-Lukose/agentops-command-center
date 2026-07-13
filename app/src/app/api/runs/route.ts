import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, withErrorHandling, zodErrorResponse } from "@/lib/errors";
import { runCreateSchema, runListQuerySchema } from "@/lib/validation/schemas";
import { enqueueRun } from "@/lib/queue";
import type { RunCreateResponse, RunListResponse } from "@/lib/types";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = runListQuerySchema.safeParse(searchParams);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { workflowId, status, limit } = parsed.data;

  const runs = await prisma.run.findMany({
    where: {
      ...(workflowId ? { workflowId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, workflowId: true, status: true, latencyMs: true, createdAt: true, finishedAt: true },
  });

  const body: RunListResponse = { runs };
  return NextResponse.json(body);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const json = await req.json().catch(() => undefined);
  const parsed = runCreateSchema.safeParse(json);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { workflowId, input } = parsed.data;

  const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!workflow) throw new ApiError("not_found", `Workflow ${workflowId} not found`);

  const run = await prisma.run.create({
    data: { workflowId, status: "queued", input: input as object },
    select: { id: true, workflowId: true, status: true, createdAt: true },
  });

  try {
    await enqueueRun(run.id);
  } catch (err) {
    // The run row exists but couldn't be enqueued — surface this clearly
    // rather than silently leaving it stuck in "queued" forever.
    console.error(`Failed to enqueue run ${run.id}:`, err);
    throw new ApiError("internal_error", "Run created but failed to enqueue for execution");
  }

  const body: RunCreateResponse = { run };
  return NextResponse.json(body, { status: 202 });
});
