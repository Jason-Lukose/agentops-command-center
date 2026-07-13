import { describe, it, expect } from "vitest";
import { Prisma, type PrismaClient } from "@prisma/client";
import { executeRun } from "@/lib/runner";
import { createFakePrisma, type FakeRun } from "./testHelpers/fakePrisma";
import type { Provider } from "@/lib/types";

const okProvider: Provider = {
  complete: async () => ({ raw: JSON.stringify({ ok: true }), tokensIn: 1, tokensOut: 1, costEstimate: 0 }),
};

function makeRun(overrides: Partial<FakeRun> = {}): FakeRun {
  return {
    id: "run_1",
    workflowId: "wf_1",
    status: "queued",
    input: { a: 1 },
    output: null,
    errorMessage: null,
    startedAt: null,
    finishedAt: null,
    latencyMs: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("executeRun — empty workflow (0 steps)", () => {
  it("completes immediately as succeeded with null output and no step executions", async () => {
    const run = makeRun();
    const { prisma, runs, stepExecutions } = createFakePrisma({ id: "wf_1", steps: [] }, run);

    await executeRun(run.id, { prisma: prisma as unknown as PrismaClient, provider: okProvider });

    const finalRun = runs.get(run.id)!;
    expect(finalRun.status).toBe("succeeded");
    // The fake prisma doesn't translate Prisma's JsonNull sentinel back to a
    // real `null` the way a real DB round-trip would (see fakePrisma.ts) —
    // assert the sentinel the runner actually writes.
    expect(finalRun.output).toBe(Prisma.JsonNull);
    expect(finalRun.finishedAt).not.toBeNull();
    expect(stepExecutions.size).toBe(0);
  });
});

describe("executeRun — run for an unknown id", () => {
  it("is a no-op (logs, doesn't throw) when the run doesn't exist", async () => {
    const run = makeRun();
    const { prisma } = createFakePrisma({ id: "wf_1", steps: [] }, run);
    await expect(
      executeRun("does_not_exist", { prisma: prisma as unknown as PrismaClient, provider: okProvider })
    ).resolves.toBeUndefined();
  });
});
