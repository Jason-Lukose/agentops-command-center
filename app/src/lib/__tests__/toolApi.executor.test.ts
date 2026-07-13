import { describe, it, expect } from "vitest";
import { runToolApiStep } from "@/lib/executors/toolApi.executor";
import type { ExecutorContext, Provider } from "@/lib/types";

const noopProvider: Provider = { complete: async () => ({ raw: "", tokensIn: 0, tokensOut: 0, costEstimate: 0 }) };

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

describe("runToolApiStep", () => {
  it("succeeds against a known mock tool (customer lookup)", async () => {
    const result = await runToolApiStep(
      ctx({
        config: { method: "GET", url: "https://mock-crm.internal/api/customers/{{ticket.customerId}}", timeoutMs: 10 },
        runInput: { ticket: { customerId: "cust_1001" } },
      })
    );
    expect(result.status).toBe("succeeded");
    expect(result.output).toMatchObject({ customerId: "cust_1001" });
  });

  it("returns a failed result on a non-200 mock response (unknown tool)", async () => {
    const result = await runToolApiStep(
      ctx({ config: { method: "GET", url: "https://unknown.internal/api/foo", timeoutMs: 10 } })
    );
    expect(result.status).toBe("failed");
    expect(result.errorMessage).toMatch(/404/);
  });

  it("fails cleanly when config.url is missing", async () => {
    const result = await runToolApiStep(ctx({ config: { method: "GET" } }));
    expect(result.status).toBe("failed");
  });
});
