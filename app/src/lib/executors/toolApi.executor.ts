import type { ExecutorContext, ExecutorResult, JsonValue } from "../types";
import { buildStepContext, resolveTemplate } from "../template";
import { callMockTool } from "./toolRegistry";

/**
 * Tool API executor. config: { method: string, url: string, timeoutMs?: number }.
 * The url may contain "{{path}}" placeholders resolved against run input +
 * prior step outputs. Dispatches to the mock tool registry (no real network
 * calls in MVP) and treats HTTP status >= 400 as a failed step.
 */
export async function runToolApiStep(ctx: ExecutorContext): Promise<ExecutorResult> {
  const config = (ctx.config ?? {}) as { method?: unknown; url?: unknown; timeoutMs?: unknown };
  const method = typeof config.method === "string" ? config.method : "GET";
  const urlTemplate = typeof config.url === "string" ? config.url : undefined;

  if (!urlTemplate) {
    return {
      status: "failed",
      output: null,
      errorMessage: "tool_api step config.url must be a non-empty string",
    };
  }

  const context = buildStepContext(ctx.runInput, ctx.priorOutputs);
  const url = resolveTemplate(urlTemplate, context);

  // Small simulated latency proportional to (but well under) the configured timeout.
  const timeoutMs = typeof config.timeoutMs === "number" ? config.timeoutMs : 2000;
  const simulatedLatency = Math.min(300, Math.max(20, Math.round(timeoutMs / 10)));
  await new Promise((resolve) => setTimeout(resolve, simulatedLatency));

  const response = callMockTool({ method, url, input: ctx.input });

  if (response.status >= 400) {
    return {
      status: "failed",
      output: null,
      errorMessage: `tool_api call to ${url} returned status ${response.status}: ${JSON.stringify(response.body)}`,
    };
  }

  return { status: "succeeded", output: response.body as JsonValue };
}
