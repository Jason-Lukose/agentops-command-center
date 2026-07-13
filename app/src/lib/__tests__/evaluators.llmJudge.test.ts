import { describe, it, expect } from "vitest";
import { evaluateLlmJudge } from "@/lib/evaluators/llmJudge";
import type { Provider } from "@/lib/types";

describe("evaluateLlmJudge — placeholder judge", () => {
  it("parses a well-formed {score, rationale} completion", async () => {
    const provider: Provider = {
      complete: async () => ({ raw: JSON.stringify({ score: 0.92, rationale: "clear and on-topic" }), tokensIn: 1, tokensOut: 1, costEstimate: 0 }),
    };
    const result = await evaluateLlmJudge("some output", { rubric: "is it helpful?" }, provider);
    expect(result.score).toBe(0.92);
    expect(result.passed).toBe(true);
    expect(result.details).toMatchObject({ rationale: "clear and on-topic" });
  });

  it("falls back to a neutral 0.5 score (and does not throw) when the completion is not parseable JSON", async () => {
    const provider: Provider = {
      complete: async () => ({ raw: "the model rambled instead of returning JSON", tokensIn: 1, tokensOut: 1, costEstimate: 0 }),
    };
    const result = await evaluateLlmJudge("some output", {}, provider);
    expect(result.score).toBe(0.5);
    expect(result.passed).toBe(false); // 0.5 < default threshold 0.7
    expect(result.details).toMatchObject({ rationale: expect.stringMatching(/unparseable/i) });
  });

  it("falls back to neutral score when the completion is valid JSON but missing a numeric score field", async () => {
    const provider: Provider = {
      complete: async () => ({ raw: JSON.stringify({ notScore: "oops" }), tokensIn: 1, tokensOut: 1, costEstimate: 0 }),
    };
    const result = await evaluateLlmJudge("x", {}, provider);
    expect(result.score).toBe(0.5);
  });

  it("respects a configured threshold at the boundary", async () => {
    const provider: Provider = {
      complete: async () => ({ raw: JSON.stringify({ score: 0.6 }), tokensIn: 1, tokensOut: 1, costEstimate: 0 }),
    };
    const result = await evaluateLlmJudge("x", { threshold: 0.6 }, provider);
    expect(result.passed).toBe(true);
  });
});
