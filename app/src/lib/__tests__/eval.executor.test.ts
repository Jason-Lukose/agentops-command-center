import { describe, it, expect } from "vitest";
import { runEvalStep } from "@/lib/executors/eval.executor";
import type { ExecutorContext, Provider } from "@/lib/types";

function ctx(overrides: Partial<ExecutorContext>): ExecutorContext {
  return {
    input: "the quick brown fox",
    config: { evaluatorType: "deterministic", checks: [{ type: "contains", value: "fox" }] },
    priorOutputs: [],
    runInput: {},
    provider: { complete: async () => ({ raw: JSON.stringify({ score: 0.8 }), tokensIn: 1, tokensOut: 1, costEstimate: 0 }) },
    ...overrides,
  };
}

describe("runEvalStep", () => {
  it("writes a score/passed/details output for a deterministic eval", async () => {
    const result = await runEvalStep(ctx({}));
    expect(result.status).toBe("succeeded");
    expect(result.output).toMatchObject({ score: 1, passed: true });
  });

  it("writes a score/passed/details output for a rubric eval", async () => {
    const provider: Provider = {
      complete: async () => ({ raw: JSON.stringify({ score: 0.9 }), tokensIn: 1, tokensOut: 1, costEstimate: 0 }),
    };
    const result = await runEvalStep(
      ctx({ config: { evaluatorType: "rubric", criteria: ["tone", "accuracy"] }, provider })
    );
    expect(result.status).toBe("succeeded");
    expect(result.output).toMatchObject({ score: 0.9, passed: true });
  });

  it("writes a structured stub output for a llm_judge eval", async () => {
    const result = await runEvalStep(ctx({ config: { evaluatorType: "llm_judge", rubric: "is it good?" } }));
    expect(result.status).toBe("succeeded");
    expect(result.output).toHaveProperty("score");
    expect(result.output).toHaveProperty("passed");
    expect(result.output).toHaveProperty("details");
  });

  it("fails cleanly on an unknown evaluatorType", async () => {
    const result = await runEvalStep(ctx({ config: { evaluatorType: "not_a_real_type" } }));
    expect(result.status).toBe("failed");
  });
});
