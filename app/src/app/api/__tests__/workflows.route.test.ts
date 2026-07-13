// Integration-style tests for the workflows route handlers, invoked
// directly (no HTTP server). Prisma is mocked with the in-memory
// apiFakePrisma helper (see docs/TEST_PLAN.md "API handler tests").

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { createApiFakePrisma } from "@/lib/__tests__/testHelpers/apiFakePrisma";

const dbMock = vi.hoisted(() => ({ prisma: {} as Record<string, unknown> }));
vi.mock("@/lib/db", () => ({ prisma: dbMock.prisma }));

import { GET, POST } from "@/app/api/workflows/route";
import { GET as GET_ONE, PUT, DELETE } from "@/app/api/workflows/[id]/route";

let fake: ReturnType<typeof createApiFakePrisma>;

beforeEach(() => {
  fake = createApiFakePrisma();
  for (const key of Object.keys(dbMock.prisma)) delete dbMock.prisma[key];
  Object.assign(dbMock.prisma, fake.prisma);
});

function jsonReq(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    headers: { "content-type": "application/json" },
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

const validCreateBody = {
  name: "Support Ticket Triage",
  description: "Classify, draft, and send",
  steps: [
    { type: "llm_prompt", name: "Classify", config: { promptTemplate: "classify: {{ticket.body}}" } },
    { type: "approval", name: "Review", config: {} },
    { type: "transform", name: "Extract", config: { expression: "ticket.body" } },
  ],
};

describe("POST /api/workflows", () => {
  it("creates a workflow with ordered steps and returns 201", async () => {
    const res = await POST(jsonReq("http://localhost/api/workflows", "POST", validCreateBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.workflow.name).toBe("Support Ticket Triage");
    expect(body.workflow.steps).toHaveLength(3);
    expect(body.workflow.steps.map((s: { position: number }) => s.position)).toEqual([0, 1, 2]);
    expect(body.workflow.steps.map((s: { type: string }) => s.type)).toEqual(["llm_prompt", "approval", "transform"]);
  });

  it("assigns sequential unique positions regardless of how many steps are submitted", async () => {
    const res = await POST(
      jsonReq("http://localhost/api/workflows", "POST", {
        name: "Five steps",
        steps: Array.from({ length: 5 }, (_, i) => ({ type: "transform", name: `Step ${i}`, config: {} })),
      })
    );
    const body = await res.json();
    const positions = body.workflow.steps.map((s: { position: number }) => s.position);
    expect(positions).toEqual([0, 1, 2, 3, 4]);
    expect(new Set(positions).size).toBe(5); // uniqueness
  });

  it("rejects a body missing a name with 400 validation_error", async () => {
    const res = await POST(
      jsonReq("http://localhost/api/workflows", "POST", { steps: validCreateBody.steps })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("validation_error");
  });

  it("rejects a workflow with zero steps with 400 validation_error (R1: not run-able until >= 1 step)", async () => {
    const res = await POST(jsonReq("http://localhost/api/workflows", "POST", { name: "Empty", steps: [] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("validation_error");
  });

  it("rejects an unknown step type with 400 validation_error (enum check)", async () => {
    const res = await POST(
      jsonReq("http://localhost/api/workflows", "POST", {
        name: "Bad type",
        steps: [{ type: "not_a_real_type", name: "x", config: {} }],
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("validation_error");
  });

  it("rejects malformed JSON body with 400 validation_error rather than throwing", async () => {
    const req = new NextRequest("http://localhost/api/workflows", {
      method: "POST",
      body: "{not json",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/workflows", () => {
  it("lists workflows with step counts, most recent first", async () => {
    await POST(jsonReq("http://localhost/api/workflows", "POST", { ...validCreateBody, name: "First" }));
    await POST(jsonReq("http://localhost/api/workflows", "POST", { ...validCreateBody, name: "Second" }));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workflows).toHaveLength(2);
    expect(body.workflows[0].stepCount).toBe(3);
  });

  it("returns an empty list, not an error, when no workflows exist", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.workflows).toEqual([]);
  });
});

describe("GET /api/workflows/[id]", () => {
  it("returns 404 not_found for an unknown id", async () => {
    const res = await GET_ONE(jsonReq("http://localhost/api/workflows/nope", "GET"), params("nope"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("not_found");
  });

  it("returns the workflow with steps in position order", async () => {
    const created = await (await POST(jsonReq("http://localhost/api/workflows", "POST", validCreateBody))).json();
    const res = await GET_ONE(jsonReq("http://localhost/api/workflows/x", "GET"), params(created.workflow.id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workflow.id).toBe(created.workflow.id);
    expect(body.workflow.steps).toHaveLength(3);
  });
});

describe("PUT /api/workflows/[id]", () => {
  it("replaces steps and re-derives sequential positions", async () => {
    const created = await (await POST(jsonReq("http://localhost/api/workflows", "POST", validCreateBody))).json();
    const res = await PUT(
      jsonReq("http://localhost/api/workflows/x", "PUT", {
        name: "Renamed",
        steps: [{ type: "eval", name: "Score it", config: { evaluatorType: "deterministic", checks: [] } }],
      }),
      params(created.workflow.id)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workflow.name).toBe("Renamed");
    expect(body.workflow.steps).toHaveLength(1);
    expect(body.workflow.steps[0].position).toBe(0);
    expect(fake.workflowSteps.size).toBe(1); // old steps were deleted, not left orphaned
  });

  it("returns 404 not_found when updating a nonexistent workflow", async () => {
    const res = await PUT(jsonReq("http://localhost/api/workflows/x", "PUT", validCreateBody), params("missing"));
    expect(res.status).toBe(404);
  });

  it("returns 400 validation_error for an invalid update body (zero steps)", async () => {
    const created = await (await POST(jsonReq("http://localhost/api/workflows", "POST", validCreateBody))).json();
    const res = await PUT(
      jsonReq("http://localhost/api/workflows/x", "PUT", { name: "x", steps: [] }),
      params(created.workflow.id)
    );
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/workflows/[id]", () => {
  it("deletes an existing workflow", async () => {
    const created = await (await POST(jsonReq("http://localhost/api/workflows", "POST", validCreateBody))).json();
    const res = await DELETE(jsonReq("http://localhost/api/workflows/x", "DELETE"), params(created.workflow.id));
    expect(res.status).toBe(200);
    const getRes = await GET_ONE(jsonReq("http://localhost/api/workflows/x", "GET"), params(created.workflow.id));
    expect(getRes.status).toBe(404);
  });

  it("returns 404 not_found deleting an unknown workflow", async () => {
    const res = await DELETE(jsonReq("http://localhost/api/workflows/x", "DELETE"), params("missing"));
    expect(res.status).toBe(404);
  });
});
