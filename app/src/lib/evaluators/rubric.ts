import type { EvaluatorResult, JsonValue, Provider } from "../types";

export interface RubricCriterionScore {
  name: string;
  weight: number;
  score: number; // 0-1
}

/**
 * Pure weighted-average scoring math (the tested core of the rubric
 * evaluator). Weights are normalized so callers can pass unweighted
 * criteria (equal weight 1 each) or explicit weights.
 */
export function computeRubricScore(
  criteria: RubricCriterionScore[],
  threshold = 0.7
): EvaluatorResult {
  if (criteria.length === 0) {
    return { score: 0, passed: false, details: { criteria: [], threshold, reason: "no criteria configured" } };
  }
  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0) || criteria.length;
  const weightedSum = criteria.reduce((sum, c) => sum + c.score * c.weight, 0);
  const score = Math.round((weightedSum / totalWeight) * 1000) / 1000;
  const passed = score >= threshold;
  const details = {
    criteria: criteria.map((c) => ({ name: c.name, weight: c.weight, score: c.score })),
    threshold,
  } as JsonValue;
  return { score, passed, details };
}

export interface RubricConfig {
  criteria?: Array<string | { name: string; weight?: number }>;
  threshold?: number;
}

/**
 * Rubric evaluator: scores each named criterion via the Provider (mock judge
 * completion), then combines them with computeRubricScore's weighted
 * average. Criteria default to equal weight when only names are given
 * (matches prisma/seed.ts config shape: { criteria: ["tone", "accuracy", ...] }).
 */
export async function evaluateRubric(
  input: JsonValue,
  config: RubricConfig,
  provider: Provider
): Promise<EvaluatorResult> {
  const criteriaSpecs = config.criteria ?? [];
  if (criteriaSpecs.length === 0) {
    return computeRubricScore([], config.threshold);
  }

  const text = typeof input === "string" ? input : JSON.stringify(input ?? null);
  const scored: RubricCriterionScore[] = [];
  for (const spec of criteriaSpecs) {
    const name = typeof spec === "string" ? spec : spec.name;
    const weight = typeof spec === "string" ? 1 : spec.weight ?? 1;
    const result = await provider.complete({
      prompt: `Judge and score the following output on "${name}" from 0 to 1:\n${text}`,
    });
    let score = 0.5;
    try {
      const parsed = JSON.parse(result.raw);
      if (typeof parsed.score === "number") score = parsed.score;
    } catch {
      // Fall back to neutral score if the provider's completion wasn't parseable JSON.
    }
    scored.push({ name, weight, score });
  }

  return computeRubricScore(scored, config.threshold ?? 0.7);
}
