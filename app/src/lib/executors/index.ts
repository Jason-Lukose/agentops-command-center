import type { ExecutorContext, ExecutorResult, StepType } from "../types";
import { runLlmPromptStep } from "./llmPrompt.executor";
import { runToolApiStep } from "./toolApi.executor";
import { runTransformStep } from "./transform.executor";
import { runApprovalStep } from "./approval.executor";
import { runEvalStep } from "./eval.executor";

export { runLlmPromptStep } from "./llmPrompt.executor";
export { runToolApiStep } from "./toolApi.executor";
export { runTransformStep } from "./transform.executor";
export { runApprovalStep } from "./approval.executor";
export { runEvalStep } from "./eval.executor";

/**
 * Whether the runner should retry this step type on transient failure.
 * Any step that can hit the provider (llm_prompt directly; eval via the
 * rubric/llm_judge evaluators) can see a ProviderTransientError and must
 * retry, or ~8% of demo runs would fail at their final eval step.
 */
export function isRetryable(stepType: StepType): boolean {
  return stepType === "llm_prompt" || stepType === "eval";
}

export async function runExecutor(stepType: StepType, ctx: ExecutorContext): Promise<ExecutorResult> {
  switch (stepType) {
    case "llm_prompt":
      return runLlmPromptStep(ctx);
    case "tool_api":
      return runToolApiStep(ctx);
    case "transform":
      return runTransformStep(ctx);
    case "approval":
      return runApprovalStep(ctx);
    case "eval":
      return runEvalStep(ctx);
  }
}
