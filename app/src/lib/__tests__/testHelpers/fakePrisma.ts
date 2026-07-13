// Thin in-memory Prisma stand-in used by runner tests (see docs/TEST_PLAN.md
// "DB & queue strategy" — runner/executor tests inject a mocked Prisma
// client rather than hitting a real database).

import type { RunStatus, StepStatus, StepType, JsonValue } from "@/lib/types";

export interface FakeWorkflowStep {
  id: string;
  workflowId: string;
  position: number;
  type: StepType;
  name: string;
  config: JsonValue;
}

export interface FakeRun {
  id: string;
  workflowId: string;
  status: RunStatus;
  input: JsonValue;
  output: JsonValue | null;
  errorMessage: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  latencyMs: number | null;
  createdAt: Date;
}

export interface FakeStepExecution {
  id: string;
  runId: string;
  stepId: string;
  position: number;
  status: StepStatus;
  input: JsonValue | null;
  output: JsonValue | null;
  errorMessage: string | null;
  retryCount: number;
  latencyMs: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  costEstimate: number | null;
  approvalDecidedAt: Date | null;
  createdAt: Date;
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

export function createFakePrisma(workflow: { id: string; steps: FakeWorkflowStep[] }, run: FakeRun) {
  const workflows = new Map([[workflow.id, workflow]]);
  const runs = new Map([[run.id, run]]);
  const stepExecutions = new Map<string, FakeStepExecution>();
  const evaluationResults: unknown[] = [];

  function matchesWhere(record: Record<string, unknown>, where: Record<string, unknown>): boolean {
    return Object.entries(where).every(([key, value]) => {
      if (value && typeof value === "object" && "in" in (value as object)) {
        const inList = (value as { in: unknown[] }).in;
        return inList.includes(record[key]);
      }
      if (value && typeof value === "object" && "notIn" in (value as object)) {
        const notInList = (value as { notIn: unknown[] }).notIn;
        return !notInList.includes(record[key]);
      }
      return record[key] === value;
    });
  }

  const prisma = {
    run: {
      findUnique: async ({ where }: { where: { id: string } }) => runs.get(where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Partial<FakeRun> }) => {
        const existing = runs.get(where.id);
        if (!existing) throw new Error(`fakePrisma: run ${where.id} not found`);
        const updated = { ...existing, ...data } as FakeRun;
        runs.set(where.id, updated);
        return updated;
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<FakeRun> }) => {
        let count = 0;
        for (const [id, record] of runs.entries()) {
          if (matchesWhere(record as unknown as Record<string, unknown>, where)) {
            runs.set(id, { ...record, ...data } as FakeRun);
            count += 1;
          }
        }
        return { count };
      },
    },
    workflow: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const wf = workflows.get(where.id);
        if (!wf) return null;
        return { ...wf, steps: [...wf.steps].sort((a, b) => a.position - b.position) };
      },
    },
    stepExecution: {
      findMany: async ({ where }: { where: { runId: string } }) =>
        [...stepExecutions.values()].filter((e) => e.runId === where.runId).sort((a, b) => a.position - b.position),
      createMany: async ({ data }: { data: Array<Partial<FakeStepExecution>> }) => {
        for (const item of data) {
          const id = nextId("se");
          stepExecutions.set(id, {
            id,
            runId: item.runId!,
            stepId: item.stepId!,
            position: item.position!,
            status: item.status ?? "pending",
            input: item.input ?? null,
            output: item.output ?? null,
            errorMessage: null,
            retryCount: 0,
            latencyMs: null,
            tokensIn: null,
            tokensOut: null,
            costEstimate: null,
            approvalDecidedAt: null,
            createdAt: new Date(),
          });
        }
        return { count: data.length };
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<FakeStepExecution> }) => {
        const existing = stepExecutions.get(where.id);
        if (!existing) throw new Error(`fakePrisma: stepExecution ${where.id} not found`);
        const updated = { ...existing, ...data } as FakeStepExecution;
        stepExecutions.set(where.id, updated);
        return updated;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Partial<FakeStepExecution>;
      }) => {
        let count = 0;
        for (const [id, record] of stepExecutions.entries()) {
          if (matchesWhere(record as unknown as Record<string, unknown>, where)) {
            stepExecutions.set(id, { ...record, ...data } as FakeStepExecution);
            count += 1;
          }
        }
        return { count };
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        [...stepExecutions.values()].find((e) => matchesWhere(e as unknown as Record<string, unknown>, where)) ?? null,
      aggregate: async ({ where }: { where: { runId: string } }) => {
        const sum = [...stepExecutions.values()]
          .filter((e) => e.runId === where.runId)
          .reduce((t, e) => t + (e.latencyMs ?? 0), 0);
        return { _sum: { latencyMs: sum } };
      },
    },
    evaluationResult: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const record = { id: nextId("eval"), createdAt: new Date(), ...data };
        evaluationResults.push(record);
        return record;
      },
    },
  };

  return { prisma, runs, stepExecutions, evaluationResults };
}
