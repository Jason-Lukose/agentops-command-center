# Data Model

> Phase 6. Prisma + PostgreSQL. Every entity traces to an MVP need: building workflows,
> executing runs, persisting traces, evaluating output, pausing on approval, and aggregating a dashboard.

## Storage

PostgreSQL 16 (local Docker), accessed via Prisma. Chosen because runs are inherently relational
(Workflow → Step → Run → StepExecution → EvaluationResult) and the dashboard needs indexed aggregate
queries over runs and step executions. `Json` columns hold per-step config and free-form input/output.

## Enums

```
StepType       = llm_prompt | tool_api | transform | approval | eval
RunStatus      = queued | running | awaiting_approval | succeeded | failed | canceled
StepStatus     = pending | running | awaiting_approval | succeeded | failed | skipped
EvaluatorType  = deterministic | rubric | llm_judge
ApprovalState  = pending | approved | rejected      // only if ApprovalRequest table is kept
```

## Entities

### Workflow  (serves: build/list workflows, dashboard)
| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String (cuid) | PK | |
| name | String | required | |
| description | String? | nullable | |
| createdAt | DateTime | default now() | |
| updatedAt | DateTime | @updatedAt | |

Relations: Workflow 1—N WorkflowStep, Workflow 1—N Run.

### WorkflowStep  (serves: ordered workflow definition)
| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String (cuid) | PK | |
| workflowId | String | FK → Workflow, onDelete Cascade | |
| position | Int | required | 0-based order within the workflow |
| type | StepType | required | |
| name | String | required | |
| config | Json | required (may be `{}`) | shape depends on `type` (prompt template, api url, transform expr, eval spec, approval prompt) |

Constraints: `@@unique([workflowId, position])` (stable ordering). Index `@@index([workflowId])`.
Relations: WorkflowStep 1—N StepExecution.

### Run  (serves: execute workflow, dashboard metrics)
| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String (cuid) | PK | |
| workflowId | String | FK → Workflow, onDelete Cascade | |
| status | RunStatus | default `queued` | |
| input | Json | required (may be `{}`) | run-level input payload |
| output | Json? | nullable | final output when succeeded |
| errorMessage | String? | nullable | terminal failure reason |
| startedAt | DateTime? | nullable | set when worker begins |
| finishedAt | DateTime? | nullable | set on terminal status |
| latencyMs | Int? | nullable | SUM of this run's `StepExecution.latencyMs` (execution time only — excludes human-approval dwell time), denormalized for dashboard. Set by the shared `executionLatencyMs` helper (`src/lib/runner.ts`) on every terminal path: runner success/failure, reject, and cancel. |
| createdAt | DateTime | default now() | |

Indexes: `@@index([workflowId])`, `@@index([status])`, `@@index([createdAt])` (recent-runs + success-rate queries).
Relations: Run 1—N StepExecution, Run 1—N EvaluationResult.

### StepExecution  (serves: trace/observability, approval state)
| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String (cuid) | PK | |
| runId | String | FK → Run, onDelete Cascade | |
| stepId | String | FK → WorkflowStep, onDelete Cascade | which step definition |
| position | Int | required | copied for stable trace ordering even if the workflow later changes |
| status | StepStatus | default `pending` | `awaiting_approval` pauses the run |
| input | Json? | nullable | resolved input to this step |
| output | Json? | nullable | step result |
| errorMessage | String? | nullable | |
| retryCount | Int | default 0 | |
| latencyMs | Int? | nullable | |
| tokensIn | Int? | nullable | placeholder (mock provider) |
| tokensOut | Int? | nullable | placeholder |
| costEstimate | Decimal? | nullable | placeholder, `@db.Decimal(10,6)` |
| approvalDecidedAt | DateTime? | nullable | set when an approval step is approved/rejected |
| createdAt | DateTime | default now() | |

Indexes: `@@index([runId])`, `@@index([runId, position])`, `@@index([status])` (dashboard "failed steps" + resume lookup).
Relations: StepExecution 1—N EvaluationResult (optional, for step-scoped evals).

### EvaluationResult  (serves: evaluation framework, dashboard eval scores)
| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String (cuid) | PK | |
| runId | String | FK → Run, onDelete Cascade | |
| stepExecutionId | String? | FK → StepExecution, onDelete Cascade, nullable | null = run-level eval |
| evaluatorType | EvaluatorType | required | deterministic \| rubric \| llm_judge |
| score | Float | required | 0–1 (deterministic → 0/1; rubric → weighted; judge → placeholder) |
| passed | Boolean | required | |
| details | Json | required (may be `{}`) | per-criterion breakdown, matched pattern, rubric weights, judge rationale |
| createdAt | DateTime | default now() | history via multiple rows over time |

Indexes: `@@index([runId])`, `@@index([stepExecutionId])`, `@@index([evaluatorType])`.

### Approval modeling — DECISION: fold into StepExecution (no separate table)
An `approval` step **is** a `StepExecution` with `status = awaiting_approval`. Approve/reject flips its
`status` to `succeeded`/`failed`, sets `approvalDecidedAt`, and (on approve) re-enqueues the run.
A separate `ApprovalRequest` table would duplicate the run/step/position/status/timestamp columns and
require keeping two rows in sync for a strictly 1:1 relationship. There is exactly one pending approval
per paused run, so the StepExecution already carries all needed state. Revisit only if approvals gain
their own fields (assignee, SLA, multi-approver) — none are in MVP scope.

## Dashboard query coverage
- **Total runs / success rate** — `Run` grouped by `status` (indexed on `status`).
- **Avg latency** — `avg(Run.latencyMs)` over terminal runs.
- **Failed steps** — `StepExecution` where `status = failed` (indexed on `status`).
- **Recent runs** — `Run` ordered by `createdAt desc limit N` (indexed on `createdAt`).
- **Eval scores** — `EvaluationResult` aggregated by `evaluatorType` / over `createdAt` for history.

## Migration Story
Dev-only, no real data yet: **drop and recreate freely**. Use `npx prisma migrate dev` during
development and `npx prisma migrate reset` to wipe + reseed. Once real data exists, schema changes on it
become a human checkpoint. The seed script recreates a polished sample workflow plus several completed
runs with full traces and eval history so the dashboard is never empty on first run.

## Data Lifecycle
Deleting a Workflow cascades to its Steps, Runs, StepExecutions, and EvaluationResults. No personal or
sensitive data is stored — inputs/outputs are demo workflow payloads. `costEstimate`/`tokens*` are
placeholders populated by the mock provider.
