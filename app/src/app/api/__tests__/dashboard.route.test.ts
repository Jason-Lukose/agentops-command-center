// GET /api/dashboard — aggregation math on a small hand-built fixture (see
// docs/TEST_PLAN.md "API handler tests"). Also covers the R9 empty-state
// requirement: zero runs must not produce NaN/blank cards.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { createApiFakePrisma, type FakeRun } from "@/lib/__tests__/testHelpers/apiFakePrisma";

const dbMock = vi.hoisted(() => ({ prisma: {} as Record<string, unknown> }));
vi.mock("@/lib/db", () => ({ prisma: dbMock.prisma }));

import { GET } from "@/app/api/dashboard/route";

let fake: ReturnType<typeof createApiFakePrisma>;

beforeEach(() => {
  fake = createApiFakePrisma();
  for (const key of Object.keys(dbMock.prisma)) delete dbMock.prisma[key];
  Object.assign(dbMock.prisma, fake.prisma);
});

function jsonReq(url: string) {
  return new NextRequest(url, { method: "GET" });
}

function baseRun(id: string, overrides: Partial<FakeRun>): FakeRun {
  return {
    id,
    workflowId: "wf_1",
    status: "succeeded",
    input: {},
    output: null,
    errorMessage: null,
    startedAt: new Date(),
    finishedAt: new Date(),
    latencyMs: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("GET /api/dashboard — empty state", () => {
  it("returns zeroed/null metrics rather than NaN or blank when there are no runs", async () => {
    const res = await GET(jsonReq("http://localhost/api/dashboard"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totals).toEqual({ runs: 0, succeeded: 0, failed: 0, successRate: 0 });
    expect(body.avgLatencyMs).toBeNull();
    expect(body.failedStepCount).toBe(0);
    expect(body.recentRuns).toEqual([]);
    expect(body.evalScores).toEqual({ deterministic: null, rubric: null, llm_judge: null });
  });
});

describe("GET /api/dashboard — aggregation math", () => {
  beforeEach(() => {
    // Fixture: 4 runs — 2 succeeded (latency 100, 300), 1 failed (latency 50),
    // 1 still queued (non-terminal, excluded from success-rate denominator).
    fake.runs.set("r1", baseRun("r1", { status: "succeeded", latencyMs: 100 }));
    fake.runs.set("r2", baseRun("r2", { status: "succeeded", latencyMs: 300 }));
    fake.runs.set("r3", baseRun("r3", { status: "failed", latencyMs: 50 }));
    fake.runs.set("r4", baseRun("r4", { status: "queued", latencyMs: null, finishedAt: null }));

    // 1 failed step total, attached to r3.
    fake.stepExecutions.set("se1", {
      id: "se1",
      runId: "r3",
      stepId: "s0",
      position: 0,
      status: "failed",
      input: null,
      output: null,
      errorMessage: "boom",
      retryCount: 0,
      latencyMs: 50,
      tokensIn: null,
      tokensOut: null,
      costEstimate: null,
      approvalDecidedAt: null,
      createdAt: new Date(),
    });

    fake.evaluationResults.set("e1", {
      id: "e1",
      runId: "r1",
      stepExecutionId: null,
      evaluatorType: "deterministic",
      score: 1,
      passed: true,
      details: {},
      createdAt: new Date(),
    });
    fake.evaluationResults.set("e2", {
      id: "e2",
      runId: "r2",
      stepExecutionId: null,
      evaluatorType: "deterministic",
      score: 0,
      passed: false,
      details: {},
      createdAt: new Date(),
    });
    fake.evaluationResults.set("e3", {
      id: "e3",
      runId: "r1",
      stepExecutionId: null,
      evaluatorType: "rubric",
      score: 0.8,
      passed: true,
      details: {},
      createdAt: new Date(),
    });
  });

  it("computes success rate as succeeded / (succeeded + failed) (2 succeeded / 3 = 0.667)", async () => {
    const res = await GET(jsonReq("http://localhost/api/dashboard"));
    const body = await res.json();
    expect(body.totals.runs).toBe(4);
    expect(body.totals.succeeded).toBe(2);
    expect(body.totals.failed).toBe(1);
    // Route rounds successRate to 3 decimals (Math.round(x * 1000) / 1000).
    expect(body.totals.successRate).toBe(0.667);
  });

  it("excludes canceled runs from the success-rate denominator (B10)", async () => {
    fake.runs.set("r5", baseRun("r5", { status: "canceled", latencyMs: 20 }));
    const res = await GET(jsonReq("http://localhost/api/dashboard"));
    const body = await res.json();
    expect(body.totals.runs).toBe(5);
    expect(body.totals.succeeded).toBe(2);
    expect(body.totals.failed).toBe(1);
    // Still 2/(2+1) = 0.667, unaffected by the added canceled run — a naive
    // succeeded/terminalCount formula would instead yield 2/4 = 0.5.
    expect(body.totals.successRate).toBe(0.667);
  });

  it("computes average latency across runs with a non-null latencyMs", async () => {
    const res = await GET(jsonReq("http://localhost/api/dashboard"));
    const body = await res.json();
    // (100 + 300 + 50) / 3 = 150
    expect(body.avgLatencyMs).toBe(150);
  });

  it("counts failed steps across all runs", async () => {
    const res = await GET(jsonReq("http://localhost/api/dashboard"));
    const body = await res.json();
    expect(body.failedStepCount).toBe(1);
  });

  it("averages eval scores per evaluator type", async () => {
    const res = await GET(jsonReq("http://localhost/api/dashboard"));
    const body = await res.json();
    expect(body.evalScores.deterministic).toBe(0.5); // (1 + 0) / 2
    expect(body.evalScores.rubric).toBe(0.8);
    expect(body.evalScores.llm_judge).toBeNull(); // none recorded
  });

  it("filters everything by workflowId when provided", async () => {
    fake.workflows.set("wf_2", { id: "wf_2", name: "other", description: null, createdAt: new Date(), updatedAt: new Date() });
    fake.runs.set("r5", { ...baseRun("r5", { status: "succeeded", latencyMs: 999 }), workflowId: "wf_2" });

    const res = await GET(jsonReq("http://localhost/api/dashboard?workflowId=wf_2"));
    const body = await res.json();
    expect(body.totals.runs).toBe(1);
    expect(body.avgLatencyMs).toBe(999);
    expect(body.failedStepCount).toBe(0);
  });

  it("lists recent runs with status + timestamp for trace linking", async () => {
    const res = await GET(jsonReq("http://localhost/api/dashboard"));
    const body = await res.json();
    expect(body.recentRuns).toHaveLength(4);
    expect(body.recentRuns[0]).toHaveProperty("id");
    expect(body.recentRuns[0]).toHaveProperty("status");
    expect(body.recentRuns[0]).toHaveProperty("createdAt");
  });
});
