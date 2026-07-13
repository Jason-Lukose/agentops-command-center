import { describe, it, expect } from "vitest";
import { runTransformStep } from "@/lib/executors/transform.executor";
import type { ExecutorContext, Provider } from "@/lib/types";

const noopProvider: Provider = {
  complete: async () => ({ raw: "", tokensIn: 0, tokensOut: 0, costEstimate: 0 }),
};

function ctx(overrides: Partial<ExecutorContext>): ExecutorContext {
  return {
    input: null,
    config: {},
    priorOutputs: [],
    runInput: {},
    provider: noopProvider,
    ...overrides,
  };
}

describe("runTransformStep", () => {
  it("parses JSON from a prior step output via JSON.parse(path)", async () => {
    const result = await runTransformStep(
      ctx({
        config: { expression: "JSON.parse(steps[0].output.raw)" },
        priorOutputs: [{ raw: JSON.stringify({ category: "billing" }) }],
      })
    );
    expect(result.status).toBe("succeeded");
    expect(result.output).toEqual({ category: "billing" });
  });

  it("resolves a plain path passthrough", async () => {
    const result = await runTransformStep(
      ctx({ config: { expression: "ticket.body" }, runInput: { ticket: { body: "hello" } } })
    );
    expect(result.status).toBe("succeeded");
    expect(result.output).toBe("hello");
  });

  it("fails cleanly on malformed JSON rather than throwing", async () => {
    const result = await runTransformStep(
      ctx({
        config: { expression: "JSON.parse(steps[0].output.raw)" },
        priorOutputs: [{ raw: "not json {" }],
      })
    );
    expect(result.status).toBe("failed");
    expect(result.errorMessage).toMatch(/not valid JSON/);
  });

  it("rejects unsupported / arbitrary-code expressions (no eval)", async () => {
    const result = await runTransformStep(
      ctx({ config: { expression: "require('fs').readFileSync('/etc/passwd')" } })
    );
    expect(result.status).toBe("failed");
    expect(result.errorMessage).toMatch(/Unsupported transform expression/);
  });

  it("fails when config.expression is missing", async () => {
    const result = await runTransformStep(ctx({ config: {} }));
    expect(result.status).toBe("failed");
  });
});
