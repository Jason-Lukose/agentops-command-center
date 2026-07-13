// NOTE: src/lib/types.ts (backend-owned) did not exist at the time this was written.
// These types mirror docs/API_SPEC.md and docs/DATA_MODEL.md. If src/lib/types.ts
// appears, prefer importing from there instead of this file.

export type StepType = "llm_prompt" | "tool_api" | "transform" | "approval" | "eval";

export type RunStatus =
  | "queued"
  | "running"
  | "awaiting_approval"
  | "succeeded"
  | "failed"
  | "canceled";

export type StepStatus =
  | "pending"
  | "running"
  | "awaiting_approval"
  | "succeeded"
  | "failed"
  | "skipped";

export type EvaluatorType = "deterministic" | "rubric" | "llm_judge";

export interface WorkflowSummary {
  id: string;
  name: string;
  description: string | null;
  stepCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStep {
  id: string;
  workflowId: string;
  position: number;
  type: StepType;
  name: string;
  config: Record<string, unknown>;
}

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  steps: WorkflowStep[];
}

export interface RunSummary {
  id: string;
  workflowId: string;
  status: RunStatus;
  latencyMs: number | null;
  createdAt: string;
  finishedAt?: string | null;
}

export interface Run {
  id: string;
  workflowId: string;
  status: RunStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  latencyMs: number | null;
  createdAt: string;
}

export interface StepExecution {
  id: string;
  runId: string;
  stepId: string;
  position: number;
  status: StepStatus;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  errorMessage: string | null;
  retryCount: number;
  latencyMs: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  costEstimate: number | string | null;
  approvalDecidedAt: string | null;
  createdAt: string;
  // Denormalized fields the UI needs; may be joined server-side. Optional so
  // the UI degrades gracefully if the API only returns the raw StepExecution.
  stepType?: StepType;
  stepName?: string;
}

export interface EvaluationResult {
  id: string;
  runId: string;
  stepExecutionId: string | null;
  evaluatorType: EvaluatorType;
  score: number;
  passed: boolean;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface RunDetail {
  run: Run;
  steps: StepExecution[];
  evaluations: EvaluationResult[];
}

export interface DashboardData {
  totals: {
    runs: number;
    succeeded: number;
    failed: number;
    successRate: number;
  };
  avgLatencyMs: number | null;
  failedStepCount: number;
  recentRuns: RunSummary[];
  evalScores: {
    deterministic: number | null;
    rubric: number | null;
    llm_judge: number | null;
  };
}

export interface ApiError {
  error: {
    code: "validation_error" | "not_found" | "invalid_state" | "internal_error";
    message: string;
  };
}

export const STEP_TYPES: { value: StepType; label: string }[] = [
  { value: "llm_prompt", label: "LLM Prompt" },
  { value: "tool_api", label: "Tool / API Call" },
  { value: "transform", label: "Transform" },
  { value: "approval", label: "Human Approval" },
  { value: "eval", label: "Evaluation" },
];
