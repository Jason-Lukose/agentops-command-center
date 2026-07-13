import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, withErrorHandling, zodErrorResponse } from "@/lib/errors";
import { workflowUpdateSchema } from "@/lib/validation/schemas";
import type { WorkflowDetailResponse } from "@/lib/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const GET = withErrorHandling(async (_req: NextRequest, { params }: RouteParams) => {
  const { id } = await params;
  const workflow = await prisma.workflow.findUnique({
    where: { id },
    include: { steps: { orderBy: { position: "asc" } } },
  });
  if (!workflow) throw new ApiError("not_found", `Workflow ${id} not found`);

  const body: WorkflowDetailResponse = { workflow };
  return NextResponse.json(body);
});

export const PUT = withErrorHandling(async (req: NextRequest, { params }: RouteParams) => {
  const { id } = await params;
  const json = await req.json().catch(() => undefined);
  const parsed = workflowUpdateSchema.safeParse(json);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { name, description, steps } = parsed.data;

  const existing = await prisma.workflow.findUnique({ where: { id } });
  if (!existing) throw new ApiError("not_found", `Workflow ${id} not found`);

  const workflow = await prisma.$transaction(async (tx) => {
    await tx.workflowStep.deleteMany({ where: { workflowId: id } });
    return tx.workflow.update({
      where: { id },
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
  });

  const body: WorkflowDetailResponse = { workflow };
  return NextResponse.json(body);
});

export const DELETE = withErrorHandling(async (_req: NextRequest, { params }: RouteParams) => {
  const { id } = await params;
  const existing = await prisma.workflow.findUnique({ where: { id } });
  if (!existing) throw new ApiError("not_found", `Workflow ${id} not found`);

  await prisma.workflow.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
