import type { Provider } from "../types";
import { MockLlmProvider } from "./mockLlmProvider";
import { OpenAiCompatProvider } from "./openaiCompatProvider";

export { MockLlmProvider } from "./mockLlmProvider";
export { OpenAiCompatProvider } from "./openaiCompatProvider";
export { ProviderTransientError } from "./provider";
export type { Provider, ProviderCompletionRequest, ProviderCompletionResult } from "../types";

let cached: Provider | undefined;

/**
 * Returns the Provider for the current PROVIDER_MODE:
 *   - "mock" (default): MockLlmProvider, zero API keys, zero network calls.
 *   - "live": OpenAiCompatProvider constructed from LLM_BASE_URL / LLM_API_KEY /
 *     LLM_MODEL — works with any OpenAI-compatible endpoint (Gemini's
 *     OpenAI-compat endpoint, Groq, OpenRouter free models). See
 *     .env.example for ready-to-uncomment free-tier presets.
 * Any other mode throws a helpful error. Switching to "live" is a human
 * checkpoint (external API + API key) — see docs/ARCHITECTURE.md.
 */
export function getProvider(): Provider {
  if (cached) return cached;
  const mode = process.env.PROVIDER_MODE ?? "mock";

  if (mode === "mock") {
    cached = new MockLlmProvider();
    return cached;
  }

  if (mode === "live") {
    const baseUrl = process.env.LLM_BASE_URL;
    const apiKey = process.env.LLM_API_KEY;
    const model = process.env.LLM_MODEL;
    const missing = [
      !baseUrl ? "LLM_BASE_URL" : null,
      !apiKey ? "LLM_API_KEY" : null,
      !model ? "LLM_MODEL" : null,
    ].filter((v): v is string => v !== null);
    if (missing.length > 0) {
      throw new Error(
        `PROVIDER_MODE="live" requires the following env var(s), which are missing: ` +
          `${missing.join(", ")}. See .env.example for free-tier presets (Gemini/Groq/OpenRouter).`
      );
    }
    cached = new OpenAiCompatProvider({ baseUrl: baseUrl!, apiKey: apiKey!, model: model! });
    return cached;
  }

  throw new Error(
    `PROVIDER_MODE="${mode}" is not supported. Use "mock" (default, no API keys) or "live" ` +
      `(real OpenAI-compatible endpoint via LLM_BASE_URL/LLM_API_KEY/LLM_MODEL, see .env.example).`
  );
}

/** Test-only: clears the cached singleton so getProvider() re-reads env/mode. */
export function resetProviderCache(): void {
  cached = undefined;
}
