import { describe, it, expect } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { executeRun } from "@/lib/runner";
import { createFakePrisma, type FakeWorkflowStep, type FakeRun } from "./testHelpers/fakePrisma";
import type { Provider } from "@/lib/types";

const okProvider: Provider = {
  complete: async () => ({ raw: JSON.stringify({ ok: true }), tokensIn: 1, tokensOut: 1, costEstimate: 0 }),
};

function makeRun(overrides: Partial<FakeRun> = {}): FakeRun {
  return {
    id: "run_1",
    workflowId: "wf_1",
    status: "queued",
    input: { ticket: { body: "help" } },
    output: null,
    errorMessage: null,
    startedAt: null,
    finishedAt: null,
    latencyMs: null,
    createdAt: new Date(),
    ...overrides,
  };
}

const steps: FakeWorkflowStep[] = [
  { id: "s0", workflowId: "wf_1", position: 0, type: "transform", name: "Prep", config: { expression: "ticket.body" } },
  { id: "s1", workflowId: "wf_1", position: 1, type: "approval", name: "Human Review", config: { prompt: "review" } },
  { id: "s2", workflowId: "wf_1", position: 2, type: "transform", name: "After approval", config: { expression: "ticket.body" } },
];

describe("executeRun — approval pause/resume", () => {
  it("pauses the run at the approval step without running later steps", async () => {
    const run = makeRun();
    const { prisma, runs, stepExecutions } = createFakePrisma({ id: "wf_1", steps }, run);

    await executeRun(run.id, { prisma: prisma as unknown as PrismaClient, provider: okProvider });

    expect(runs.get(run.id)!.status).toBe("awaiting_approval");
    const executions = [...stepExecutions.values()].sort((a, b) => a.position - b.position);
    expect(executions.map((e) => e.status)).toEqual(["succeeded", "awaiting_approval", "pending"]);
  });

  it("resumes from the first non-terminal step after the approval step is flipped to succeeded", async () => {
    const run = makeRun();
    const { prisma, runs, stepExecutions } = createFakePrisma({ id: "wf_1", steps }, run);

    // First pass: pauses at approval.
    await executeRun(run.id, { prisma: prisma as unknown as PrismaClient, provider: okProvider });
    expect(runs.get(run.id)!.status).toBe("awaiting_approval");

    // Simulate what POST /api/runs/{id}/approve does: flip the pending
    // approval StepExecution to succeeded, set run back to queued.
    const approvalExec = [...stepExecutions.values()].find((e) => e.position === 1)!;
    stepExecutions.set(approvalExec.id, {
      ...approvalExec,
      status: "succeeded",
      output: { decision: "approved" },
      approvalDecidedAt: new Date(),
    });
    runs.set(run.id, { ...runs.get(run.id)!, status: "queued" });

    // Resume.
    await executeRun(run.id, { prisma: prisma as unknown as PrismaClient, provider: okProvider });

    expect(runs.get(run.id)!.status).toBe("succeeded");
    const executions = [...stepExecutions.values()].sort((a, b) => a.position - b.position);
    expect(executions.map((e) => e.status)).toEqual(["succeeded", "succeeded", "succeeded"]);
  });
});
