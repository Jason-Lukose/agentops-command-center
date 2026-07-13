import type { ExecutorContext, ExecutorResult, JsonValue } from "../types";
import { runEvaluator } from "../evaluators";
import { ProviderTransientError } from "../providers/provider";

/**
 * Eval executor. config: { evaluatorType: "deterministic"|"rubric"|"llm_judge", ...evaluator-specific }.
 * Delegates scoring to src/lib/evaluators/*. The runner persists the
 * resulting EvaluationResult row (see src/lib/runner.ts) — this executor
 * only computes the score and folds it into the step output so the trace
 * shows it inline as well.
 */
export async function runEvalStep(ctx: ExecutorContext): Promise<ExecutorResult> {
  const config = (ctx.config ?? {}) as { evaluatorType?: unknown };
  const evaluatorType = config.evaluatorType;

  if (evaluatorType !== "deterministic" && evaluatorType !== "rubric" && evaluatorType !== "llm_judge") {
    return {
      status: "failed",
      output: null,
      errorMessage: `eval step config.evaluatorType must be one of deterministic|rubric|llm_judge, got "${String(evaluatorType)}"`,
    };
  }

  try {
    const result = await runEvaluator(evaluatorType, ctx.input, ctx.config, ctx.provider);
    return {
      status: "succeeded",
      output: { score: result.score, passed: result.passed, details: result.details } as JsonValue,
    };
  } catch (err) {
    if (err instanceof ProviderTransientError) {
      // Rethrow so the runner's retry loop can fire (isRetryable("eval") is
      // true) — swallowing it here made eval retries unreachable and the
      // approval demo flake ~1 in 5 (BUGS.md B5, reopened by ship review).
      throw err;
    }
    return {
      status: "failed",
      output: null,
      errorMessage: err instanceof Error ? err.message : "eval step failed",
    };
  }
}
