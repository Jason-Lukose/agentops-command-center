import { describe, it, expect } from "vitest";
import { runApprovalStep } from "@/lib/executors/approval.executor";
import type { ExecutorContext, Provider } from "@/lib/types";

const noopProvider: Provider = { complete: async () => ({ raw: "", tokensIn: 0, tokensOut: 0, costEstimate: 0 }) };

describe("runApprovalStep", () => {
  it("always sets status awaiting_approval and halts", async () => {
    const ctx: ExecutorContext = {
      input: { draft: "reply" },
      config: { prompt: "Review this" },
      priorOutputs: [],
      runInput: {},
      provider: noopProvider,
    };
    const result = await runApprovalStep(ctx);
    expect(result.status).toBe("awaiting_approval");
    expect(result.output).toBeNull();
  });
});
