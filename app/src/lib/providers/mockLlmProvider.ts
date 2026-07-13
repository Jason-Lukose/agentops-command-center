import type { Provider, ProviderCompletionRequest, ProviderCompletionResult } from "../types";
import { ProviderTransientError } from "./provider";

export interface MockLlmProviderOptions {
  /** Injectable RNG in [0, 1) for deterministic tests. Defaults to Math.random. */
  rng?: () => number;
  /** Fixed latency in ms (overrides the simulated 150-1200ms range). Set 0 in tests. */
  latencyMs?: number;
  /** Probability (0-1) of a simulated transient failure per call. Default 0.08. */
  failureRate?: number;
}

/** Simple deterministic hash so the "canned" output varies with prompt content
 *  but is stable across calls with the same prompt (useful for tests/demos). */
function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(hash);
}

function pick<T>(items: readonly T[], seed: number): T {
  return items[seed % items.length];
}

const CATEGORIES = ["billing", "bug", "cancellation", "account", "feature_request"] as const;
const URGENCIES = ["low", "medium", "high"] as const;

const REPLY_OPENERS = [
  "Thanks for reaching out — I've looked into this and here's what I found.",
  "Appreciate your patience here; I've dug into the details on our end.",
  "Sorry for the trouble — let's get this sorted out for you.",
];

const REPLY_CLOSERS = [
  "Let me know if you have any other questions.",
  "I'll follow up if anything changes on our end.",
  "Happy to help further if this doesn't fully resolve it.",
];

const TITLE_TEMPLATES = [
  "A Quick Look at {{topic}}",
  "Understanding {{topic}}: Key Takeaways",
  "What You Need to Know About {{topic}}",
];

/**
 * Deterministic-but-varied mock LLM provider. Produces canned completions
 * keyed off prompt content so it looks plausible for classification, drafted
 * replies, summaries, titles, and judge scoring — with simulated latency and
 * an occasional simulated transient failure to exercise retry logic.
 */
export class MockLlmProvider implements Provider {
  private readonly rng: () => number;
  private readonly fixedLatencyMs: number | undefined;
  private readonly failureRate: number;

  constructor(options: MockLlmProviderOptions = {}) {
    this.rng = options.rng ?? Math.random;
    this.fixedLatencyMs = options.latencyMs;
    this.failureRate = options.failureRate ?? 0.08;
  }

  async complete(req: ProviderCompletionRequest): Promise<ProviderCompletionResult> {
    const latencyMs = this.fixedLatencyMs ?? Math.round(150 + this.rng() * (1200 - 150));
    if (latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, latencyMs));
    }

    if (this.rng() < this.failureRate) {
      throw new ProviderTransientError(
        `Mock provider transient failure: upstream timeout after ${latencyMs}ms`
      );
    }

    const raw = this.generateCompletion(req.prompt);
    const tokensIn = this.estimateTokens(req.prompt);
    const tokensOut = this.estimateTokens(raw);
    return {
      raw,
      tokensIn,
      tokensOut,
      costEstimate: this.costEstimate(tokensIn, tokensOut),
    };
  }

  private estimateTokens(text: string): number {
    // Rough heuristic: ~4 chars per token, minimum 1.
    return Math.max(1, Math.round(text.length / 4));
  }

  private costEstimate(tokensIn: number, tokensOut: number): number {
    // Mock GPT-4o-mini-ish pricing, matches prisma/seed.ts.
    const cost = tokensIn * 0.00000015 + tokensOut * 0.0000006;
    return Math.round(cost * 1_000_000) / 1_000_000;
  }

  private generateCompletion(prompt: string): string {
    const seed = hashString(prompt);
    const lower = prompt.toLowerCase();

    if (lower.includes("classify")) {
      const category = pick(CATEGORIES, seed);
      const urgency = pick(URGENCIES, seed >> 2);
      const confidence = Math.round((0.75 + (seed % 25) / 100) * 100) / 100;
      return JSON.stringify({ category, urgency, confidence });
    }

    if (lower.includes("judge") || lower.includes("score") || lower.includes("evaluate")) {
      const score = Math.round((0.6 + (seed % 40) / 100) * 100) / 100;
      const rationale = "The output substantively addresses the prompt's intent with acceptable clarity.";
      return JSON.stringify({ score, rationale });
    }

    if (lower.includes("title")) {
      const topicMatch = prompt.match(/:\s*\n?(.{5,40})/);
      const topic = (topicMatch?.[1] ?? "This Update").trim().replace(/[.,]$/, "");
      return pick(TITLE_TEMPLATES, seed).replace("{{topic}}", topic);
    }

    if (lower.includes("summar")) {
      const sentenceCount = 2 + (seed % 2);
      const sentences = Array.from(
        { length: sentenceCount },
        (_, i) => `Key point ${i + 1} distilled from the source content, seed ${seed % 997}.`
      );
      return sentences.join(" ");
    }

    if (lower.includes("draft") || lower.includes("reply") || lower.includes("respond")) {
      const opener = pick(REPLY_OPENERS, seed);
      const closer = pick(REPLY_CLOSERS, seed >> 3);
      return `${opener} ${closer}`;
    }

    // Generic fallback completion.
    return `Mock completion (seed ${seed % 9973}) for prompt of length ${prompt.length}.`;
  }
}
