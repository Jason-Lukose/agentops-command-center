import type { Provider } from "../types";
import { MockLlmProvider } from "./mockLlmProvider";

export { MockLlmProvider } from "./mockLlmProvider";
export { ProviderTransientError } from "./provider";
export type { Provider, ProviderCompletionRequest, ProviderCompletionResult } from "../types";

let cached: Provider | undefined;

/**
 * Returns the Provider for the current PROVIDER_MODE. Only "mock" is
 * supported in MVP — switching to a real provider is a human checkpoint
 * (new external API + API key), see docs/ARCHITECTURE.md.
 */
export function getProvider(): Provider {
  if (cached) return cached;
  const mode = process.env.PROVIDER_MODE ?? "mock";
  if (mode !== "mock") {
    throw new Error(
      `PROVIDER_MODE="${mode}" is not supported in MVP. Only "mock" is implemented; ` +
        `switching to a real provider requires a human checkpoint (external API + API key).`
    );
  }
  cached = new MockLlmProvider();
  return cached;
}
