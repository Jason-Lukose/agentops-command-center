import type { Provider, ProviderCompletionRequest, ProviderCompletionResult } from "../types";

export type { Provider, ProviderCompletionRequest, ProviderCompletionResult };

/** Thrown by a Provider to signal a transient, retryable failure (e.g. simulated timeout). */
export class ProviderTransientError extends Error {
  constructor(message = "Provider transient failure") {
    super(message);
    this.name = "ProviderTransientError";
  }
}
