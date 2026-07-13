import type { EvaluatorResult, JsonValue, Provider } from "../types";

export interface LlmJudgeConfig {
  rubric?: string;
  threshold?: number;
}

/**
 * LLM-judge evaluator — a placeholder per docs/TEST_PLAN.md "Known Gaps": no
 * real model backs this in MVP, only its structure (calls Provider, parses a
 * {score, rationale} completion) is exercised. Real judge quality is out of
 * scope until a real Provider is wired in behind a human checkpoint.
 */
export async function evaluateLlmJudge(
  input: JsonValue,
  config: LlmJudgeConfig,
  provider: Provider
): Promise<EvaluatorResult> {
  const text = typeof input === "string" ? input : JSON.stringify(input ?? null);
  const rubric = config.rubric ?? "Does the output satisfy the intent of the task?";
  const threshold = config.threshold ?? 0.7;

  const result = await provider.complete({
    prompt: `Judge the following output against this rubric: ${rubric}\nOutput:\n${text}`,
  });

  let score = 0.5;
  let rationale = "unparseable judge completion; defaulted to neutral score";
  try {
    const parsed = JSON.parse(result.raw);
    if (typeof parsed.score === "number") score = parsed.score;
    if (typeof parsed.rationale === "string") rationale = parsed.rationale;
  } catch {
    // Keep the neutral default above.
  }

  return {
    score,
    passed: score >= threshold,
    details: { rubric, threshold, rationale },
  };
}
