import type { PrismaClient } from "@prisma/client";
import type { EvaluatorResult, EvaluatorType, JsonValue, Provider } from "../types";
import { evaluateDeterministic, type DeterministicConfig } from "./deterministic";
import { evaluateRubric, type RubricConfig } from "./rubric";
import { evaluateLlmJudge, type LlmJudgeConfig } from "./llmJudge";

export { evaluateDeterministic } from "./deterministic";
export { evaluateRubric, computeRubricScore } from "./rubric";
export { evaluateLlmJudge } from "./llmJudge";

/** Dispatches to the evaluator matching config.evaluatorType. */
export async function runEvaluator(
  evaluatorType: EvaluatorType,
  input: JsonValue,
  config: JsonValue,
  provider: Provider
): Promise<EvaluatorResult> {
  const cfg = (config ?? {}) as Record<string, unknown>;
  switch (evaluatorType) {
    case "deterministic":
      return evaluateDeterministic(input, cfg as DeterministicConfig);
    case "rubric":
      return evaluateRubric(input, cfg as RubricConfig, provider);
    case "llm_judge":
      return evaluateLlmJudge(input, cfg as LlmJudgeConfig, provider);
  }
}

/** Persists an EvaluationResult row for a run (and optionally a specific step execution). */
export async function persistEvaluationResult(
  prisma: PrismaClient,
  params: {
    runId: string;
    stepExecutionId: string | null;
    evaluatorType: EvaluatorType;
    result: EvaluatorResult;
  }
) {
  return prisma.evaluationResult.create({
    data: {
      runId: params.runId,
      stepExecutionId: params.stepExecutionId,
      evaluatorType: params.evaluatorType,
      score: params.result.score,
      passed: params.result.passed,
      details: params.result.details as object,
    },
  });
}
