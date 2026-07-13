import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withErrorHandling, zodErrorResponse } from "@/lib/errors";
import { workflowCreateSchema } from "@/lib/validation/schemas";
import type { WorkflowListResponse, WorkflowDetailResponse } from "@/lib/types";

export const GET = withErrorHandling(async () => {
  const workflows = await prisma.workflow.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { steps: true } } },
  });

  const body: WorkflowListResponse = {
    workflows: workflows.map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      stepCount: w._count.steps,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    })),
  };
  return NextResponse.json(body);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const json = await req.json().catch(() => undefined);
  const parsed = workflowCreateSchema.safeParse(json);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { name, description, steps } = parsed.data;

  const workflow = await prisma.workflow.create({
    data: {
      name,
      description,
      steps: {
        create: steps.map((step, position) => ({
          type: step.type,
          name: step.name,
          config: step.config as object,
          position,
        })),
      },
    },
    include: { steps: { orderBy: { position: "asc" } } },
  });

  const body: WorkflowDetailResponse = { workflow };
  return NextResponse.json(body, { status: 201 });
});
