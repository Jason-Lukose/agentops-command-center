// POST /api/runs/[id]/approve — happy path re-enqueues, wrong-state and
// double-approve return 409 invalid_state, unknown run 404.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { createApiFakePrisma } from "@/lib/__tests__/testHelpers/apiFakePrisma";

const dbMock = vi.hoisted(() => ({ prisma: {} as Record<string, unknown> }));
vi.mock("@/lib/db", () => ({ prisma: dbMock.prisma }));

const queueMock = vi.hoisted(() => ({ enqueueRun: vi.fn(async () => {}) }));
vi.mock("@/lib/queue", () => ({ enqueueRun: queueMock.enqueueRun }));

import { POST as approve } from "@/app/api/runs/[id]/approve/route";

let fake: ReturnType<typeof createApiFakePrisma>;

beforeEach(() => {
  fake = createApiFakePrisma();
  for (const key of Object.keys(dbMock.prisma)) delete dbMock.prisma[key];
  Object.assign(dbMock.prisma, fake.prisma);
  queueMock.enqueueRun.mockReset();
  queueMock.enqueueRun.mockResolvedValue(undefined);
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
    startedAt: new Date(),
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
    input: { context: "prior output" },
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

describe("POST /api/runs/[id]/approve", () => {
  it("approves the pending step, requeues the run, and re-enqueues a job", async () => {
    seedAwaitingApprovalRun();
    const res = await approve(jsonReq("http://localhost/api/runs/run_1/approve", { note: "looks good" }), params("run_1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.run.status).toBe("queued");
    expect(fake.stepExecutions.get("se_1")!.status).toBe("succeeded");
    expect(fake.stepExecutions.get("se_1")!.output).toEqual({ decision: "approved", note: "looks good" });
    expect(fake.stepExecutions.get("se_1")!.approvalDecidedAt).not.toBeNull();
    expect(queueMock.enqueueRun).toHaveBeenCalledWith("run_1");
  });

  it("returns 404 not_found for an unknown run", async () => {
    const res = await approve(jsonReq("http://localhost/api/runs/nope/approve"), params("nope"));
    expect(res.status).toBe(404);
  });

  it("returns 409 invalid_state when approving a run that is not awaiting_approval", async () => {
    fake.runs.set("run_2", {
      id: "run_2",
      workflowId: "wf_1",
      status: "succeeded",
      input: {},
      output: null,
      errorMessage: null,
      startedAt: null,
      finishedAt: new Date(),
      latencyMs: 1,
      createdAt: new Date(),
    });
    const res = await approve(jsonReq("http://localhost/api/runs/run_2/approve"), params("run_2"));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_state");
    expect(queueMock.enqueueRun).not.toHaveBeenCalled();
  });

  it("rejects a double-approve with 409 invalid_state (run already moved past awaiting_approval)", async () => {
    seedAwaitingApprovalRun();
    const first = await approve(jsonReq("http://localhost/api/runs/run_1/approve"), params("run_1"));
    expect(first.status).toBe(200);

    // Second approve call on the same run: it's now "queued", not
    // "awaiting_approval" — this must be rejected, not silently re-applied.
    const second = await approve(jsonReq("http://localhost/api/runs/run_1/approve"), params("run_1"));
    expect(second.status).toBe(409);
    const body = await second.json();
    expect(body.error.code).toBe("invalid_state");
    expect(queueMock.enqueueRun).toHaveBeenCalledTimes(1); // not called again
  });
});
