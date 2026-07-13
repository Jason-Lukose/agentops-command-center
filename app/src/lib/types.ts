// Shared domain + API response types.
// Mirrors docs/API_SPEC.md and prisma/schema.prisma. Frontend imports from here.

import type {
  Workflow,
  WorkflowStep,
  Run,
  StepExecution,
  EvaluationResult,
  StepType,
  RunStatus,
  StepStatus,
  EvaluatorType,
} from "@prisma/client";

export type { StepType, RunStatus, StepStatus, EvaluatorType };

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

// ---------------------------------------------------------------------------
// Error envelope — docs/API_SPEC.md "Conventions"
// ---------------------------------------------------------------------------

export type ErrorCode = "validation_error" | "not_found" | "invalid_state" | "internal_error";

export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

// ---------------------------------------------------------------------------
// Workflows
// ---------------------------------------------------------------------------

export type WorkflowWithSteps = Workflow & { steps: WorkflowStep[] };

export interface WorkflowListItem {
  id: string;
  name: string;
  description: string | null;
  stepCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowListResponse {
  workflows: WorkflowListItem[];
}

export interface WorkflowDetailResponse {
  workflow: WorkflowWithSteps;
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

export interface RunCreateResponse {
  run: Pick<Run, "id" | "workflowId" | "status" | "createdAt">;
}

export interface RunListItem {
  id: string;
  workflowId: string;
  status: RunStatus;
  latencyMs: number | null;
  createdAt: Date;
  finishedAt: Date | null;
}

export interface RunListResponse {
  runs: RunListItem[];
}

export interface RunDetailResponse {
  run: Run;
  steps: StepExecution[];
  evaluations: EvaluationResult[];
}

export interface RunActionResponse {
  run: Run;
}

// ---------------------------------------------------------------------------
// Evaluations
// ---------------------------------------------------------------------------

export interface EvaluationListResponse {
  evaluations: EvaluationResult[];
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardResponse {
  totals: {
    runs: number;
    succeeded: number;
    failed: number;
    successRate: number;
  };
  avgLatencyMs: number | null;
  failedStepCount: number;
  recentRuns: Array<{
    id: string;
    workflowId: string;
    status: RunStatus;
    latencyMs: number | null;
    createdAt: Date;
  }>;
  evalScores: {
    deterministic: number | null;
    rubric: number | null;
    llm_judge: number | null;
  };
}

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

export interface ProviderCompletionRequest {
  prompt: string;
  model?: string;
  temperature?: number;
}

export interface ProviderCompletionResult {
  raw: string;
  tokensIn: number;
  tokensOut: number;
  costEstimate: number;
}

export interface Provider {
  complete(req: ProviderCompletionRequest): Promise<ProviderCompletionResult>;
}

// ---------------------------------------------------------------------------
// Executors
// ---------------------------------------------------------------------------

export interface ExecutorContext {
  /** Resolved input for this step (already template-substituted). */
  input: JsonValue;
  /** Raw step config from WorkflowStep.config. */
  config: JsonValue;
  /** Prior step outputs in position order, for expressions like steps[0].output. */
  priorOutputs: JsonValue[];
  /** Run-level input payload, for expressions like ticket.body. */
  runInput: JsonValue;
  provider: Provider;
}

export interface ExecutorResult {
  status: "succeeded" | "failed" | "awaiting_approval";
  output: JsonValue | null;
  errorMessage?: string;
  retryCount?: number;
  tokensIn?: number;
  tokensOut?: number;
  costEstimate?: number;
}

// ---------------------------------------------------------------------------
// Evaluators
// ---------------------------------------------------------------------------

export interface EvaluatorResult {
  score: number;
  passed: boolean;
  details: JsonValue;
}
