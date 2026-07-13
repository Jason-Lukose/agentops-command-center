import type { ExecutorContext, ExecutorResult, JsonValue } from "../types";
import { buildStepContext, resolveTemplate } from "../template";
import { ProviderTransientError } from "../providers/provider";

/**
 * LLM prompt executor. config: { promptTemplate: string, model?: string, temperature?: number }.
 * Resolves "{{path}}" placeholders against run input + prior step outputs, calls
 * the Provider, and returns the raw completion alongside token/cost placeholders.
 *
 * Retries are the runner's responsibility (it calls this once per attempt); this
 * executor surfaces ProviderTransientError distinctly via the thrown error so the
 * runner can decide whether to retry.
 */
export async function runLlmPromptStep(ctx: ExecutorContext): Promise<ExecutorResult> {
  const config = (ctx.config ?? {}) as { promptTemplate?: unknown; model?: unknown; temperature?: unknown };
  const promptTemplate = typeof config.promptTemplate === "string" ? config.promptTemplate : undefined;

  if (!promptTemplate) {
    return {
      status: "failed",
      output: null,
      errorMessage: "llm_prompt step config.promptTemplate must be a non-empty string",
    };
  }

  const context = buildStepContext(ctx.runInput, ctx.priorOutputs);
  const prompt = resolveTemplate(promptTemplate, context);

  try {
    const result = await ctx.provider.complete({
      prompt,
      model: typeof config.model === "string" ? config.model : undefined,
      temperature: typeof config.temperature === "number" ? config.temperature : undefined,
    });

    let parsed: JsonValue = { raw: result.raw };
    try {
      const asJson = JSON.parse(result.raw);
      if (asJson && typeof asJson === "object") {
        parsed = { raw: result.raw, ...(asJson as Record<string, JsonValue>) };
      }
    } catch {
      // Not JSON — keep the raw completion only. This is expected for free-text completions.
    }

    return {
      status: "succeeded",
      output: parsed,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      costEstimate: result.costEstimate,
    };
  } catch (err) {
    if (err instanceof ProviderTransientError) {
      // Re-throw so the runner's retry loop can distinguish transient failures.
      throw err;
    }
    return {
      status: "failed",
      output: null,
      errorMessage: err instanceof Error ? err.message : "llm_prompt step failed",
    };
  }
}
