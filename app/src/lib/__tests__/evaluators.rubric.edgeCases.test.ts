import { describe, it, expect } from "vitest";
import { evaluateRubric } from "@/lib/evaluators/rubric";
import type { Provider } from "@/lib/types";

describe("evaluateRubric — explicit weights that don't sum to 1", () => {
  it("normalizes by total weight rather than assuming weights sum to 1", async () => {
    // tone weight 2, accuracy weight 5 -> total weight 7, not 1.
    const scores: Record<string, number> = { tone: 1.0, accuracy: 0.0 };
    const provider: Provider = {
      complete: async ({ prompt }) => {
        const name = /"([^"]+)"/.exec(prompt)?.[1] ?? "";
        return { raw: JSON.stringify({ score: scores[name] ?? 0.5 }), tokensIn: 1, tokensOut: 1, costEstimate: 0 };
      },
    };
    const result = await evaluateRubric(
      "output text",
      { criteria: [{ name: "tone", weight: 2 }, { name: "accuracy", weight: 5 }] },
      provider
    );
    // (2*1.0 + 5*0.0) / 7 = 0.2857... -> rounded to 3dp
    expect(result.score).toBe(0.286);
    expect(result.passed).toBe(false);
  });

  it("treats an unweighted criteria list as equal-weight (weight defaults to 1 each)", async () => {
    const provider: Provider = {
      complete: async () => ({ raw: JSON.stringify({ score: 1 }), tokensIn: 1, tokensOut: 1, costEstimate: 0 }),
    };
    const result = await evaluateRubric("x", { criteria: ["a", "b", "c"] }, provider);
    expect(result.score).toBe(1);
  });

  it("returns a not-passed 0 score when no criteria are configured, without calling the provider", async () => {
    let called = false;
    const provider: Provider = {
      complete: async () => {
        called = true;
        return { raw: JSON.stringify({ score: 1 }), tokensIn: 1, tokensOut: 1, costEstimate: 0 };
      },
    };
    const result = await evaluateRubric("x", { criteria: [] }, provider);
    expect(result.score).toBe(0);
    expect(result.passed).toBe(false);
    expect(called).toBe(false);
  });
});
