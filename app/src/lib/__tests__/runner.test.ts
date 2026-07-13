import { describe, it, expect } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { executeRun } from "@/lib/runner";
import { createFakePrisma, type FakeWorkflowStep, type FakeRun } from "./testHelpers/fakePrisma";
import type { Provider } from "@/lib/types";

function makeWorkflow(steps: FakeWorkflowStep[]) {
  return { id: "wf_1", steps };
}

function makeRun(overrides: Partial<FakeRun> = {}): FakeRun {
  return {
    id: "run_1",
    workflowId: "wf_1",
    status: "queued",
    input: { article: { body: "hello world" } },
    output: null,
    errorMessage: null,
    startedAt: null,
    finishedAt: null,
    latencyMs: null,
    createdAt: new Date(),
    ...overrides,
  };
}

const okProvider: Provider = {
  complete: async () => ({ raw: JSON.stringify({ summary: "a summary" }), tokensIn: 5, tokensOut: 3, costEstimate: 0.0001 }),
};

describe("executeRun — ordering + success", () => {
  it("runs steps in position order and marks the run succeeded", async () => {
    const steps: FakeWorkflowStep[] = [
      { id: "s0", workflowId: "wf_1", position: 0, type: "llm_prompt", name: "Summarize", config: { promptTemplate: "Summarize: {{article.body}}" } },
      { id: "s1", workflowId: "wf_1", position: 1, type: "transform", name: "Extract", config: { expression: "JSON.parse(steps[0].output.raw)" } },
    ];
    const run = makeRun();
    const { prisma, runs, stepExecutions } = createFakePrisma(makeWorkflow(steps), run);

    await executeRun(run.id, { prisma: prisma as unknown as PrismaClient, provider: okProvider });

    const finalRun = runs.get(run.id)!;
    expect(finalRun.status).toBe("succeeded");
    expect(finalRun.finishedAt).not.toBeNull();
    expect(finalRun.latencyMs).toBeGreaterThanOrEqual(0);

    const executions = [...stepExecutions.values()].sort((a, b) => a.position - b.position);
    expect(executions.map((e) => e.status)).toEqual(["succeeded", "succeeded"]);
    expect(executions[0].tokensIn).toBe(5);
  });
});

describe("executeRun — stop-on-failure", () => {
  it("marks the failing step failed and all subsequent steps skipped", async () => {
    const steps: FakeWorkflowStep[] = [
      { id: "s0", workflowId: "wf_1", position: 0, type: "transform", name: "Bad", config: { expression: "missing.path" } },
      { id: "s1", workflowId: "wf_1", position: 1, type: "transform", name: "Never runs", config: { expression: "article.body" } },
      { id: "s2", workflowId: "wf_1", position: 2, type: "transform", name: "Never runs 2", config: { expression: "article.body" } },
    ];
    const run = makeRun();
    const { prisma, runs, stepExecutions } = createFakePrisma(makeWorkflow(steps), run);

    await executeRun(run.id, { prisma: prisma as unknown as PrismaClient, provider: okProvider });

    const finalRun = runs.get(run.id)!;
    expect(finalRun.status).toBe("failed");
    expect(finalRun.errorMessage).toBeTruthy();

    const executions = [...stepExecutions.values()].sort((a, b) => a.position - b.position);
    expect(executions.map((e) => e.status)).toEqual(["failed", "skipped", "skipped"]);
  });
});

describe("executeRun — retry on transient failure", () => {
  it("retries a transient llm_prompt failure and records retryCount", async () => {
    let calls = 0;
    const flakyProvider: Provider = {
      complete: async () => {
        calls += 1;
        if (calls < 2) {
          const { ProviderTransientError } = await import("@/lib/providers/provider");
          throw new ProviderTransientError("simulated timeout");
        }
        return { raw: "ok", tokensIn: 1, tokensOut: 1, costEstimate: 0 };
      },
    };
    const steps: FakeWorkflowStep[] = [
      { id: "s0", workflowId: "wf_1", position: 0, type: "llm_prompt", name: "Flaky", config: { promptTemplate: "go" } },
    ];
    const run = makeRun();
    const { prisma, runs, stepExecutions } = createFakePrisma(makeWorkflow(steps), run);

    await executeRun(run.id, { prisma: prisma as unknown as PrismaClient, provider: flakyProvider });

    expect(runs.get(run.id)!.status).toBe("succeeded");
    const exec = [...stepExecutions.values()][0];
    expect(exec.status).toBe("succeeded");
    expect(exec.retryCount).toBe(1);
    expect(calls).toBe(2);
  });

  it("retries a transient eval-step provider failure and records retryCount (B5 regression)", async () => {
    let calls = 0;
    const flakyJudge: Provider = {
      complete: async () => {
        calls += 1;
        if (calls < 2) {
          const { ProviderTransientError } = await import("@/lib/providers/provider");
          throw new ProviderTransientError("simulated judge timeout");
        }
        return { raw: JSON.stringify({ score: 0.9, rationale: "fine" }), tokensIn: 1, tokensOut: 1, costEstimate: 0 };
      },
    };
    const steps: FakeWorkflowStep[] = [
      { id: "s0", workflowId: "wf_1", position: 0, type: "eval", name: "Judge", config: { evaluatorType: "llm_judge", threshold: 0.7 } },
    ];
    const run = makeRun();
    const { prisma, runs, stepExecutions, evaluationResults } = createFakePrisma(makeWorkflow(steps), run);

    await executeRun(run.id, { prisma: prisma as unknown as PrismaClient, provider: flakyJudge });

    expect(runs.get(run.id)!.status).toBe("succeeded");
    const exec = [...stepExecutions.values()][0];
    expect(exec.status).toBe("succeeded");
    expect(exec.retryCount).toBe(1); // fails without the eval.executor rethrow
    expect(calls).toBe(2);
    expect(evaluationResults.length).toBe(1);
  });
});

describe("executeRun — cancel/worker-start race (B6)", () => {
  it("does not resurrect a run canceled between the initial load and the start-running write", async () => {
    const steps: FakeWorkflowStep[] = [
      { id: "s0", workflowId: "wf_1", position: 0, type: "transform", name: "x", config: { expression: "article.body" } },
    ];
    const run = makeRun({ status: "queued" });
    const { prisma, runs, stepExecutions } = createFakePrisma(makeWorkflow(steps), run);

    // Simulate a cancel committing (status -> canceled, steps -> skipped) in
    // the window right after the runner's initial `run.findUnique` load but
    // before it writes "running".
    const originalFindUnique = prisma.run.findUnique;
    let loaded = false;
    prisma.run.findUnique = (async (args: { where: { id: string } }) => {
      const result = await originalFindUnique(args);
      if (!loaded) {
        loaded = true;
        const existing = runs.get(run.id)!;
        runs.set(run.id, { ...existing, status: "canceled", finishedAt: new Date() });
      }
      return result;
    }) as typeof prisma.run.findUnique;

    await executeRun(run.id, { prisma: prisma as unknown as PrismaClient, provider: okProvider });

    const finalRun = runs.get(run.id)!;
    expect(finalRun.status).toBe("canceled");
    // The runner must not have created/advanced step executions past the race.
    expect([...stepExecutions.values()].every((e) => e.status === "pending" || e.status === "skipped")).toBe(true);
  });
});

describe("executeRun — idempotency", () => {
  it("is a no-op on a run that is already terminal", async () => {
    const steps: FakeWorkflowStep[] = [
      { id: "s0", workflowId: "wf_1", position: 0, type: "transform", name: "x", config: { expression: "article.body" } },
    ];
    const run = makeRun({ status: "succeeded", finishedAt: new Date(), latencyMs: 100 });
    const { prisma, runs } = createFakePrisma(makeWorkflow(steps), run);

    await executeRun(run.id, { prisma: prisma as unknown as PrismaClient, provider: okProvider });

    expect(runs.get(run.id)!.status).toBe("succeeded");
    expect(runs.get(run.id)!.latencyMs).toBe(100);
  });
});
