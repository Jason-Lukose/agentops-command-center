// POST /api/runs/[id]/reject — terminates the run REJECTED-equivalent
// ("failed" per src/lib/errors.ts + prisma RunStatus, see docs/API_SPEC.md),
// skips remaining steps, and persists the decision. Wrong-state and unknown
// run cases mirror the approve route.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { createApiFakePrisma } from "@/lib/__tests__/testHelpers/apiFakePrisma";

const dbMock = vi.hoisted(() => ({ prisma: {} as Record<string, unknown> }));
vi.mock("@/lib/db", () => ({ prisma: dbMock.prisma }));

import { POST as reject } from "@/app/api/runs/[id]/reject/route";

let fake: ReturnType<typeof createApiFakePrisma>;

beforeEach(() => {
  fake = createApiFakePrisma();
  for (const key of Object.keys(dbMock.prisma)) delete dbMock.prisma[key];
  Object.assign(dbMock.prisma, fake.prisma);
});

function jsonReq(url: string, body?: unknown) {
  return new NextRequest(url, {
    method: "POST",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    headers: { "content-type": "application/json" },
  });
}
function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function seedAwaitingApprovalRun(runId = "run_1") {
  fake.runs.set(runId, {
    id: runId,
    workflowId: "wf_1",
    status: "awaiting_approval",
    input: {},
    output: null,
    errorMessage: null,
    startedAt: new Date(Date.now() - 1000),
    finishedAt: null,
    latencyMs: null,
    createdAt: new Date(),
  });
  fake.stepExecutions.set("se_0", {
    id: "se_0",
    runId,
    stepId: "s0",
    position: 0,
    status: "succeeded",
    input: {},
    output: {},
    errorMessage: null,
    retryCount: 0,
    latencyMs: 5,
    tokensIn: null,
    tokensOut: null,
    costEstimate: null,
    approvalDecidedAt: null,
    createdAt: new Date(),
  });
  fake.stepExecutions.set("se_1", {
    id: "se_1",
    runId,
    stepId: "s1",
    position: 1,
    status: "awaiting_approval",
    input: {},
    output: null,
    errorMessage: null,
    retryCount: 0,
    latencyMs: null,
    tokensIn: null,
    tokensOut: null,
    costEstimate: null,
    approvalDecidedAt: null,
    createdAt: new Date(),
  });
  fake.stepExecutions.set("se_2", {
    id: "se_2",
    runId,
    stepId: "s2",
    position: 2,
    status: "pending",
    input: null,
    output: null,
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

describe("POST /api/runs/[id]/reject", () => {
  it("terminates the run, marks the approval step rejected, and skips remaining steps", async () => {
    seedAwaitingApprovalRun();
    const res = await reject(jsonReq("http://localhost/api/runs/run_1/reject", { note: "not safe to send" }), params("run_1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.run.status).toBe("failed");
    expect(body.run.finishedAt).not.toBeNull();
    expect(body.run.errorMessage).toMatch(/not safe to send/);

    expect(fake.stepExecutions.get("se_1")!.status).toBe("failed");
    expect(fake.stepExecutions.get("se_1")!.output).toEqual({ decision: "rejected", note: "not safe to send" });
    expect(fake.stepExecutions.get("se_1")!.approvalDecidedAt).not.toBeNull();
    // Step after the approval never runs.
    expect(fake.stepExecutions.get("se_2")!.status).toBe("skipped");
    // Step before the approval is untouched.
    expect(fake.stepExecutions.get("se_0")!.status).toBe("succeeded");
  });

  it("returns 404 not_found for an unknown run", async () => {
    const res = await reject(jsonReq("http://localhost/api/runs/nope/reject"), params("nope"));
    expect(res.status).toBe(404);
  });

  it("returns 409 invalid_state when rejecting a run that is not awaiting_approval", async () => {
    fake.runs.set("run_2", {
      id: "run_2",
      workflowId: "wf_1",
      status: "queued",
      input: {},
      output: null,
      errorMessage: null,
      startedAt: null,
      finishedAt: null,
      latencyMs: null,
      createdAt: new Date(),
    });
    const res = await reject(jsonReq("http://localhost/api/runs/run_2/reject"), params("run_2"));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_state");
  });

  it("rejects a double-reject with 409 invalid_state (already terminal)", async () => {
    seedAwaitingApprovalRun();
    const first = await reject(jsonReq("http://localhost/api/runs/run_1/reject"), params("run_1"));
    expect(first.status).toBe(200);
    const second = await reject(jsonReq("http://localhost/api/runs/run_1/reject"), params("run_1"));
    expect(second.status).toBe(409);
  });
});
