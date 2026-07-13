import type { ExecutorContext, ExecutorResult } from "../types";

/**
 * Approval executor. config: { prompt: string, requiredRole?: string }.
 * Always halts the run — sets status "awaiting_approval". Resume is driven by
 * POST /api/runs/{id}/approve|reject (see src/lib/runner.ts), never here.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature kept for parity with other executors
export async function runApprovalStep(_ctx: ExecutorContext): Promise<ExecutorResult> {
  return {
    status: "awaiting_approval",
    output: null,
    errorMessage: undefined,
  };
}
