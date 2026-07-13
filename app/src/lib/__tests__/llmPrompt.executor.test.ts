import { describe, it, expect } from "vitest";
import { runLlmPromptStep } from "@/lib/executors/llmPrompt.executor";
import { ProviderTransientError } from "@/lib/providers/provider";
import type { ExecutorContext, Provider } from "@/lib/types";

function ctx(overrides: Partial<ExecutorContext>): ExecutorContext {
  return {
    input: null,
    config: { promptTemplate: "Summarize: {{article.body}}" },
    priorOutputs: [],
    runInput: { article: { body: "hello world" } },
    provider: overrides.provider ?? { complete: async () => ({ raw: "ok", tokensIn: 1, tokensOut: 1, costEstimate: 0 }) },
    ...overrides,
  };
}

describe("runLlmPromptStep", () => {
  it("calls the provider and writes output + token placeholders", async () => {
    const provider: Provider = {
      complete: async (req) => {
        expect(req.prompt).toContain("hello world");
        return { raw: JSON.stringify({ summary: "a summary" }), tokensIn: 42, tokensOut: 7, costEstimate: 0.001 };
      },
    };
    const result = await runLlmPromptStep(ctx({ provider }));
    expect(result.status).toBe("succeeded");
    expect(result.output).toMatchObject({ summary: "a summary" });
    expect(result.tokensIn).toBe(42);
    expect(result.tokensOut).toBe(7);
    expect(result.costEstimate).toBe(0.001);
  });

  it("wraps non-JSON completions as { raw }", async () => {
    const provider: Provider = {
      complete: async () => ({ raw: "plain text completion", tokensIn: 1, tokensOut: 1, costEstimate: 0 }),
    };
    const result = await runLlmPromptStep(ctx({ provider }));
    expect(result.output).toEqual({ raw: "plain text completion" });
  });

  it("re-throws ProviderTransientError so the runner can retry", async () => {
    const provider: Provider = {
      complete: async () => {
        throw new ProviderTransientError("timeout");
      },
    };
    await expect(runLlmPromptStep(ctx({ provider }))).rejects.toThrow(ProviderTransientError);
  });

  it("returns a failed result for non-transient provider errors", async () => {
    const provider: Provider = {
      complete: async () => {
        throw new Error("boom");
      },
    };
    const result = await runLlmPromptStep(ctx({ provider }));
    expect(result.status).toBe("failed");
    expect(result.errorMessage).toBe("boom");
  });

  it("fails cleanly when config.promptTemplate is missing", async () => {
    const result = await runLlmPromptStep(ctx({ config: {} }));
    expect(result.status).toBe("failed");
  });
});
