// POST /api/runs and GET /api/runs — enqueue is mocked (queue itself is
// exercised nowhere in this suite, see docs/TEST_PLAN.md "DB & queue
// strategy"); this asserts the API contract: 202 + enqueue call, 400 on bad
// body, 404 on unknown workflow.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { createApiFakePrisma } from "@/lib/__tests__/testHelpers/apiFakePrisma";

const dbMock = vi.hoisted(() => ({ prisma: {} as Record<string, unknown> }));
vi.mock("@/lib/db", () => ({ prisma: dbMock.prisma }));

const queueMock = vi.hoisted(() => ({ enqueueRun: vi.fn(async () => {}) }));
vi.mock("@/lib/queue", () => ({ enqueueRun: queueMock.enqueueRun }));

import { GET, POST } from "@/app/api/runs/route";

let fake: ReturnType<typeof createApiFakePrisma>;

beforeEach(() => {
  fake = createApiFakePrisma();
  for (const key of Object.keys(dbMock.prisma)) delete dbMock.prisma[key];
  Object.assign(dbMock.prisma, fake.prisma);
  queueMock.enqueueRun.mockReset();
  queueMock.enqueueRun.mockResolvedValue(undefined);
});

function jsonReq(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    headers: { "content-type": "application/json" },
  });
}

function seedWorkflow(id = "wf_1") {
  fake.workflows.set(id, { id, name: "wf", description: null, createdAt: new Date(), updatedAt: new Date() });
  fake.workflowSteps.set("s0", { id: "s0", workflowId: id, position: 0, type: "transform", name: "x", config: { expression: "a" } });
}

describe("POST /api/runs", () => {
  it("creates a queued run, returns 202, and enqueues a job", async () => {
    seedWorkflow();
    const res = await POST(jsonReq("http://localhost/api/runs", "POST", { workflowId: "wf_1", input: { a: 1 } }));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.run.status).toBe("queued");
    expect(body.run.workflowId).toBe("wf_1");
    expect(queueMock.enqueueRun).toHaveBeenCalledTimes(1);
    expect(queueMock.enqueueRun).toHaveBeenCalledWith(body.run.id);
  });

  it("rejects a body missing workflowId with 400 validation_error", async () => {
    const res = await POST(jsonReq("http://localhost/api/runs", "POST", { input: {} }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("validation_error");
    expect(queueMock.enqueueRun).not.toHaveBeenCalled();
  });

  it("defaults input to {} when omitted", async () => {
    seedWorkflow();
    const res = await POST(jsonReq("http://localhost/api/runs", "POST", { workflowId: "wf_1" }));
    expect(res.status).toBe(202);
  });

  it("returns 404 not_found for an unknown workflowId and does not create a run", async () => {
    const res = await POST(jsonReq("http://localhost/api/runs", "POST", { workflowId: "missing", input: {} }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("not_found");
    expect(fake.runs.size).toBe(0);
    expect(queueMock.enqueueRun).not.toHaveBeenCalled();
  });

  it("surfaces a 500 internal_error (not a silent stuck run) if enqueueing fails", async () => {
    seedWorkflow();
    queueMock.enqueueRun.mockRejectedValueOnce(new Error("redis down"));
    const res = await POST(jsonReq("http://localhost/api/runs", "POST", { workflowId: "wf_1", input: {} }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("internal_error");
    // The run row was still created — visible, not silently lost.
    expect(fake.runs.size).toBe(1);
  });
});

describe("GET /api/runs", () => {
  it("lists runs filtered by workflowId and status", async () => {
    seedWorkflow("wf_1");
    seedWorkflow("wf_2");
    fake.runs.set("r1", { id: "r1", workflowId: "wf_1", status: "succeeded", input: {}, output: null, errorMessage: null, startedAt: null, finishedAt: null, latencyMs: 10, createdAt: new Date() });
    fake.runs.set("r2", { id: "r2", workflowId: "wf_1", status: "failed", input: {}, output: null, errorMessage: "x", startedAt: null, finishedAt: null, latencyMs: 5, createdAt: new Date() });
    fake.runs.set("r3", { id: "r3", workflowId: "wf_2", status: "succeeded", input: {}, output: null, errorMessage: null, startedAt: null, finishedAt: null, latencyMs: 1, createdAt: new Date() });

    const res = await GET(jsonReq("http://localhost/api/runs?workflowId=wf_1&status=succeeded", "GET"));
    const body = await res.json();
    expect(body.runs).toHaveLength(1);
    expect(body.runs[0].id).toBe("r1");
  });

  it("rejects an invalid status filter with 400 validation_error", async () => {
    const res = await GET(jsonReq("http://localhost/api/runs?status=not_a_status", "GET"));
    expect(res.status).toBe(400);
  });

  it("returns an empty list, not an error, when there are no runs", async () => {
    const res = await GET(jsonReq("http://localhost/api/runs", "GET"));
    const body = await res.json();
    expect(body.runs).toEqual([]);
  });

  it("clamps limit>200 to 200 instead of rejecting (B9, API_SPEC max 200)", async () => {
    const res = await GET(jsonReq("http://localhost/api/runs?limit=9999", "GET"));
    expect(res.status).toBe(200);
  });

  it("clamps limit<1 up to 1 instead of rejecting", async () => {
    const res = await GET(jsonReq("http://localhost/api/runs?limit=0", "GET"));
    expect(res.status).toBe(200);
  });
});
