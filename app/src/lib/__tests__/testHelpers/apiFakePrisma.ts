// In-memory Prisma stand-in for API route-handler tests (src/app/api/__tests__/**).
//
// Route handlers import a module-level `prisma` singleton from "@/lib/db".
// Tests mock that module (see usage in the API test files) and swap this
// fake's in-memory store in per-test via `resetApiFakePrisma`. This mirrors
// the existing runner-level `fakePrisma.ts` pattern but covers the broader
// surface of Prisma calls the API routes make (groupBy/aggregate/count/
// $transaction/relation filters), which the runner-level fake doesn't need.
//
// It is intentionally NOT a general-purpose Prisma emulator — only the
// query shapes actually used by src/app/api/**/route.ts are supported.

import type {
  JsonValue,
  RunStatus,
  StepStatus,
  StepType,
  EvaluatorType,
} from "@/lib/types";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

export interface FakeWorkflow {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

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

export interface FakeEvaluationResult {
  id: string;
  runId: string;
  stepExecutionId: string | null;
  evaluatorType: EvaluatorType;
  score: number;
  passed: boolean;
  details: JsonValue;
  createdAt: Date;
}

type Where = Record<string, unknown> | undefined;

function matchesWhere(
  record: Record<string, unknown>,
  where: Where,
  relations: { run?: Map<string, FakeRun> } = {}
): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) return true;
    if (key === "run" && relations.run) {
      const run = relations.run.get(record.runId as string);
      if (!run) return false;
      return matchesWhere(run as unknown as Record<string, unknown>, value as Where);
    }
    if (value && typeof value === "object" && !(value instanceof Date)) {
      const obj = value as Record<string, unknown>;
      if ("in" in obj) return (obj.in as unknown[]).includes(record[key]);
      if ("not" in obj) return record[key] !== obj.not;
      if ("gt" in obj) return (record[key] as number) > (obj.gt as number);
    }
    return record[key] === value;
  });
}

function applySelect<T extends Record<string, unknown>>(record: T, select?: Record<string, boolean>): Partial<T> {
  if (!select) return record;
  const out: Partial<T> = {};
  for (const key of Object.keys(select)) {
    if (select[key]) (out as Record<string, unknown>)[key] = record[key as keyof T];
  }
  return out;
}

export function createApiFakePrisma() {
  const workflows = new Map<string, FakeWorkflow>();
  const workflowSteps = new Map<string, FakeWorkflowStep>();
  const runs = new Map<string, FakeRun>();
  const stepExecutions = new Map<string, FakeStepExecution>();
  const evaluationResults = new Map<string, FakeEvaluationResult>();

  function stepsFor(workflowId: string): FakeWorkflowStep[] {
    return [...workflowSteps.values()]
      .filter((s) => s.workflowId === workflowId)
      .sort((a, b) => a.position - b.position);
  }

  function createStepsFromData(
    workflowId: string,
    creates: Array<{ type: StepType; name: string; config: JsonValue; position: number }>
  ): void {
    for (const c of creates) {
      const id = nextId("step");
      workflowSteps.set(id, { id, workflowId, position: c.position, type: c.type, name: c.name, config: c.config });
    }
  }

  const prisma = {
    workflow: {
      findMany: async ({
        orderBy,
        include,
      }: {
        orderBy?: { createdAt?: "asc" | "desc" };
        include?: { _count?: { select: { steps: true } } };
      } = {}) => {
        let list = [...workflows.values()];
        if (orderBy?.createdAt === "desc") list = list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        else if (orderBy?.createdAt === "asc") list = list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        return list.map((w) =>
          include?._count ? { ...w, _count: { steps: stepsFor(w.id).length } } : w
        );
      },
      findUnique: async ({
        where,
        include,
      }: {
        where: { id: string };
        include?: { steps?: { orderBy: { position: "asc" } } };
      }) => {
        const w = workflows.get(where.id);
        if (!w) return null;
        return include?.steps ? { ...w, steps: stepsFor(w.id) } : w;
      },
      create: async ({
        data,
        include,
      }: {
        data: {
          name: string;
          description?: string | null;
          steps: { create: Array<{ type: StepType; name: string; config: JsonValue; position: number }> };
        };
        include?: { steps?: unknown };
      }) => {
        const id = nextId("wf");
        const now = new Date();
        const workflow: FakeWorkflow = {
          id,
          name: data.name,
          description: data.description ?? null,
          createdAt: now,
          updatedAt: now,
        };
        workflows.set(id, workflow);
        createStepsFromData(id, data.steps.create);
        return include?.steps ? { ...workflow, steps: stepsFor(id) } : workflow;
      },
      update: async ({
        where,
        data,
        include,
      }: {
        where: { id: string };
        data: {
          name?: string;
          description?: string | null;
          steps?: { create: Array<{ type: StepType; name: string; config: JsonValue; position: number }> };
        };
        include?: { steps?: unknown };
      }) => {
        const existing = workflows.get(where.id);
        if (!existing) throw new Error(`apiFakePrisma: workflow ${where.id} not found`);
        const updated: FakeWorkflow = {
          ...existing,
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          updatedAt: new Date(),
        };
        workflows.set(where.id, updated);
        if (data.steps?.create) createStepsFromData(where.id, data.steps.create);
        return include?.steps ? { ...updated, steps: stepsFor(where.id) } : updated;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const existing = workflows.get(where.id);
        if (!existing) throw new Error(`apiFakePrisma: workflow ${where.id} not found`);
        workflows.delete(where.id);
        for (const s of stepsFor(where.id)) workflowSteps.delete(s.id);
        return existing;
      },
    },
    workflowStep: {
      deleteMany: async ({ where }: { where: { workflowId: string } }) => {
        let count = 0;
        for (const [id, s] of workflowSteps.entries()) {
          if (s.workflowId === where.workflowId) {
            workflowSteps.delete(id);
            count += 1;
          }
        }
        return { count };
      },
    },
    run: {
      findMany: async ({
        where,
        orderBy,
        take,
        select,
      }: {
        where?: Where;
        orderBy?: { createdAt?: "asc" | "desc" };
        take?: number;
        select?: Record<string, boolean>;
      } = {}) => {
        let list = [...runs.values()].filter((r) => matchesWhere(r as unknown as Record<string, unknown>, where));
        if (orderBy?.createdAt === "desc") list = list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        if (take !== undefined) list = list.slice(0, take);
        return list.map((r) => applySelect(r as unknown as Record<string, unknown>, select));
      },
      findUnique: async ({ where }: { where: { id: string } }) => runs.get(where.id) ?? null,
      create: async ({
        data,
        select,
      }: {
        data: { workflowId: string; status: RunStatus; input: JsonValue };
        select?: Record<string, boolean>;
      }) => {
        const id = nextId("run");
        const run: FakeRun = {
          id,
          workflowId: data.workflowId,
          status: data.status,
          input: data.input,
          output: null,
          errorMessage: null,
          startedAt: null,
          finishedAt: null,
          latencyMs: null,
          createdAt: new Date(),
        };
        runs.set(id, run);
        return applySelect(run as unknown as Record<string, unknown>, select);
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<FakeRun> }) => {
        const existing = runs.get(where.id);
        if (!existing) throw new Error(`apiFakePrisma: run ${where.id} not found`);
        const updated = { ...existing, ...data } as FakeRun;
        runs.set(where.id, updated);
        return updated;
      },
      groupBy: async ({
        by,
        where,
        _count,
      }: {
        by: string[];
        where?: Where;
        _count?: { _all: boolean };
      }) => {
        const list = [...runs.values()].filter((r) => matchesWhere(r as unknown as Record<string, unknown>, where));
        const key = by[0] as keyof FakeRun;
        const groups = new Map<unknown, number>();
        for (const r of list) {
          const k = r[key];
          groups.set(k, (groups.get(k) ?? 0) + 1);
        }
        return [...groups.entries()].map(([k, count]) => ({
          [key]: k,
          _count: _count ? { _all: count } : undefined,
        }));
      },
      aggregate: async ({ where, _avg }: { where?: Where; _avg?: { latencyMs?: boolean } }) => {
        const list = [...runs.values()].filter((r) => matchesWhere(r as unknown as Record<string, unknown>, where));
        if (!_avg?.latencyMs) return { _avg: { latencyMs: null } };
        const values = list.map((r) => r.latencyMs).filter((v): v is number => v !== null);
        const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
        return { _avg: { latencyMs: avg } };
      },
    },
    stepExecution: {
      findMany: async ({
        where,
        orderBy,
      }: {
        where?: Where;
        orderBy?: { position?: "asc" | "desc" };
      } = {}) => {
        let list = [...stepExecutions.values()].filter((e) =>
          matchesWhere(e as unknown as Record<string, unknown>, where)
        );
        if (orderBy?.position === "asc") list = list.sort((a, b) => a.position - b.position);
        return list;
      },
      findFirst: async ({ where }: { where?: Where }) =>
        [...stepExecutions.values()].find((e) => matchesWhere(e as unknown as Record<string, unknown>, where)) ??
        null,
      create: async ({ data }: { data: Partial<FakeStepExecution> & { runId: string; stepId: string; position: number } }) => {
        const id = nextId("se");
        const record: FakeStepExecution = {
          id,
          runId: data.runId,
          stepId: data.stepId,
          position: data.position,
          status: data.status ?? "pending",
          input: data.input ?? null,
          output: data.output ?? null,
          errorMessage: data.errorMessage ?? null,
          retryCount: data.retryCount ?? 0,
          latencyMs: data.latencyMs ?? null,
          tokensIn: data.tokensIn ?? null,
          tokensOut: data.tokensOut ?? null,
          costEstimate: data.costEstimate ?? null,
          approvalDecidedAt: data.approvalDecidedAt ?? null,
          createdAt: new Date(),
        };
        stepExecutions.set(id, record);
        return record;
      },
      createMany: async ({ data }: { data: Array<Partial<FakeStepExecution> & { runId: string; stepId: string; position: number }> }) => {
        for (const item of data) {
          const id = nextId("se");
          stepExecutions.set(id, {
            id,
            runId: item.runId,
            stepId: item.stepId,
            position: item.position,
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
        if (!existing) throw new Error(`apiFakePrisma: stepExecution ${where.id} not found`);
        const updated = { ...existing, ...data } as FakeStepExecution;
        stepExecutions.set(where.id, updated);
        return updated;
      },
      updateMany: async ({ where, data }: { where?: Where; data: Partial<FakeStepExecution> }) => {
        let count = 0;
        for (const [id, record] of stepExecutions.entries()) {
          if (matchesWhere(record as unknown as Record<string, unknown>, where)) {
            stepExecutions.set(id, { ...record, ...data } as FakeStepExecution);
            count += 1;
          }
        }
        return { count };
      },
      count: async ({ where }: { where?: Where } = {}) =>
        [...stepExecutions.values()].filter((e) => matchesWhere(e as unknown as Record<string, unknown>, where, { run: runs })).length,
      aggregate: async ({ where, _sum }: { where?: Where; _sum?: { latencyMs?: boolean } }) => {
        const list = [...stepExecutions.values()].filter((e) =>
          matchesWhere(e as unknown as Record<string, unknown>, where)
        );
        if (!_sum?.latencyMs) return { _sum: { latencyMs: null } };
        const sum = list.reduce((t, e) => t + (e.latencyMs ?? 0), 0);
        return { _sum: { latencyMs: sum } };
      },
    },
    evaluationResult: {
      findMany: async ({
        where,
        orderBy,
      }: {
        where?: Where;
        orderBy?: { createdAt?: "asc" | "desc" };
      } = {}) => {
        let list = [...evaluationResults.values()].filter((e) =>
          matchesWhere(e as unknown as Record<string, unknown>, where)
        );
        if (orderBy?.createdAt === "asc") list = list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        return list;
      },
      create: async ({ data }: { data: Omit<FakeEvaluationResult, "id" | "createdAt"> }) => {
        const id = nextId("eval");
        const record: FakeEvaluationResult = { id, createdAt: new Date(), ...data };
        evaluationResults.set(id, record);
        return record;
      },
      aggregate: async ({ where, _avg }: { where?: Where; _avg?: { score?: boolean } }) => {
        const list = [...evaluationResults.values()].filter((e) =>
          matchesWhere(e as unknown as Record<string, unknown>, where, { run: runs })
        );
        if (!_avg?.score) return { _avg: { score: null } };
        const avg = list.length > 0 ? list.reduce((t, e) => t + e.score, 0) / list.length : null;
        return { _avg: { score: avg } };
      },
    },
    $transaction: async <T>(fn: (tx: Record<string, unknown>) => Promise<T>): Promise<T> =>
      fn(prisma as unknown as Record<string, unknown>),
  };

  return { prisma, workflows, workflowSteps, runs, stepExecutions, evaluationResults };
}
