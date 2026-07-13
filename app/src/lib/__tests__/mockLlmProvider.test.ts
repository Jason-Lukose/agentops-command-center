import { describe, it, expect } from "vitest";
import { MockLlmProvider } from "@/lib/providers/mockLlmProvider";
import { ProviderTransientError } from "@/lib/providers/provider";

describe("MockLlmProvider", () => {
  it("returns deterministic-ish output keyed off prompt content, with zero latency when configured", async () => {
    const provider = new MockLlmProvider({ latencyMs: 0, failureRate: 0 });
    const result = await provider.complete({ prompt: "Classify the following support ticket: it is broken" });
    const parsed = JSON.parse(result.raw);
    expect(parsed).toHaveProperty("category");
    expect(parsed).toHaveProperty("urgency");
    expect(parsed).toHaveProperty("confidence");
    expect(result.tokensIn).toBeGreaterThan(0);
    expect(result.tokensOut).toBeGreaterThan(0);
    expect(result.costEstimate).toBeGreaterThanOrEqual(0);
  });

  it("is stable across repeated calls with the same prompt", async () => {
    const provider = new MockLlmProvider({ latencyMs: 0, failureRate: 0 });
    const a = await provider.complete({ prompt: "Summarize the following article:\nHello world." });
    const b = await provider.complete({ prompt: "Summarize the following article:\nHello world." });
    expect(a.raw).toBe(b.raw);
  });

  it("simulates latency (fixed override)", async () => {
    const provider = new MockLlmProvider({ latencyMs: 20, failureRate: 0 });
    const start = Date.now();
    await provider.complete({ prompt: "draft a reply to a customer" });
    expect(Date.now() - start).toBeGreaterThanOrEqual(15);
  });

  it("throws ProviderTransientError when failureRate forces a failure", async () => {
    const provider = new MockLlmProvider({ latencyMs: 0, failureRate: 1, rng: () => 0 });
    await expect(provider.complete({ prompt: "anything" })).rejects.toThrow(ProviderTransientError);
  });

  it("never fails when failureRate is 0", async () => {
    const provider = new MockLlmProvider({ latencyMs: 0, failureRate: 0 });
    for (let i = 0; i < 10; i++) {
      await expect(provider.complete({ prompt: `call ${i}` })).resolves.toBeDefined();
    }
  });
});
