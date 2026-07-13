// OpenAI-compatible chat-completions provider. Plain fetch, no vendor SDK
// dependency — a single implementation covers any endpoint that speaks the
// OpenAI chat-completions wire format, including:
//   - Google Gemini's OpenAI-compat endpoint (generous free tier)
//   - Groq (free tier)
//   - OpenRouter free models
// See .env.example for ready-to-uncomment presets and docs/DECISIONS.md for
// the "why one fetch impl" rationale.

import type { Provider, ProviderCompletionRequest, ProviderCompletionResult } from "../types";
import { ProviderTransientError } from "./provider";

export interface OpenAiCompatProviderOptions {
  /** Base URL of the OpenAI-compatible API, e.g. "https://api.groq.com/openai/v1" (no trailing slash needed). */
  baseUrl: string;
  /** API key sent as `Authorization: Bearer <key>`. */
  apiKey: string;
  /** Default model id, e.g. "llama-3.3-70b-versatile". Overridable per-request via req.model. */
  model: string;
  /** Request timeout in ms. Default 30000. */
  timeoutMs?: number;
  /** Injectable fetch implementation, for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Provider implementation for any OpenAI-compatible chat-completions API.
 * Free tier only in this project — costEstimate is always 0.
 */
export class OpenAiCompatProvider implements Provider {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAiCompatProviderOptions) {
    if (!options.baseUrl) throw new Error("OpenAiCompatProvider: baseUrl is required");
    if (!options.apiKey) throw new Error("OpenAiCompatProvider: apiKey is required");
    if (!options.model) throw new Error("OpenAiCompatProvider: model is required");
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async complete(req: ProviderCompletionRequest): Promise<ProviderCompletionResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: req.model ?? this.model,
          messages: [{ role: "user", content: req.prompt }],
          ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new ProviderTransientError(
          `OpenAI-compat provider request timed out after ${this.timeoutMs}ms`
        );
      }
      // Network failure (DNS, connection refused, etc.) — treat as transient/retryable.
      const message = err instanceof Error ? err.message : String(err);
      throw new ProviderTransientError(`OpenAI-compat provider network error: ${message}`);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const status = response.status;
      if (status === 408 || status === 429 || status >= 500) {
        throw new ProviderTransientError(
          `OpenAI-compat provider returned transient status ${status}`
        );
      }
      // Permanent client errors (401/403/400/etc.) — never include the API key.
      throw new Error(
        `OpenAI-compat provider request failed with status ${status}. Check LLM_BASE_URL, ` +
          `LLM_MODEL, and that LLM_API_KEY is valid for this endpoint.`
      );
    }

    let data: ChatCompletionResponse;
    try {
      data = (await response.json()) as ChatCompletionResponse;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`OpenAI-compat provider returned invalid JSON: ${message}`);
    }

    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("OpenAI-compat provider response missing choices[0].message.content");
    }

    const tokensIn = data.usage?.prompt_tokens ?? 0;
    const tokensOut = data.usage?.completion_tokens ?? 0;

    return {
      raw: content,
      tokensIn,
      tokensOut,
      costEstimate: 0, // free tier only in this project
    };
  }
}
