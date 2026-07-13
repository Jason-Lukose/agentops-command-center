import { describe, it, expect } from "vitest";
import { computeRubricScore, evaluateRubric } from "@/lib/evaluators/rubric";
import type { Provider } from "@/lib/types";

describe("computeRubricScore", () => {
  it("computes an equal-weight average correctly", () => {
    const result = computeRubricScore([
      { name: "tone", weight: 1, score: 0.8 },
      { name: "accuracy", weight: 1, score: 0.6 },
    ]);
    expect(result.score).toBe(0.7);
  });

  it("computes a weighted average correctly", () => {
    const result = computeRubricScore([
      { name: "tone", weight: 3, score: 1.0 },
      { name: "accuracy", weight: 1, score: 0.0 },
    ]);
    // (3*1.0 + 1*0.0) / 4 = 0.75
    expect(result.score).toBe(0.75);
  });

  it("is exactly at the threshold boundary => passed", () => {
    const result = computeRubricScore([{ name: "x", weight: 1, score: 0.7 }], 0.7);
    expect(result.passed).toBe(true);
  });

  it("just below threshold => not passed", () => {
    const result = computeRubricScore([{ name: "x", weight: 1, score: 0.699 }], 0.7);
    expect(result.passed).toBe(false);
  });

  it("returns score 0 / not passed with no criteria", () => {
    const result = computeRubricScore([]);
    expect(result.score).toBe(0);
    expect(result.passed).toBe(false);
  });
});

describe("evaluateRubric", () => {
  it("scores each named criterion via the provider and combines them", async () => {
    const provider: Provider = {
      complete: async () => ({ raw: JSON.stringify({ score: 0.9 }), tokensIn: 1, tokensOut: 1, costEstimate: 0 }),
    };
    const result = await evaluateRubric("some output", { criteria: ["tone", "accuracy"] }, provider);
    expect(result.score).toBe(0.9);
    expect(result.passed).toBe(true);
  });

  it("falls back to a neutral score when the provider completion is not parseable JSON", async () => {
    const provider: Provider = {
      complete: async () => ({ raw: "not json", tokensIn: 1, tokensOut: 1, costEstimate: 0 }),
    };
    const result = await evaluateRubric("x", { criteria: ["tone"] }, provider);
    expect(result.score).toBe(0.5);
  });
});
