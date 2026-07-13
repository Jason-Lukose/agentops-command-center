# API Specification

> Phase 5 draft; keep in sync with code (Phase 9/14). REST route handlers under `app/src/app/api/`.
> Must match the code — drift here is a review finding.

## Conventions
- Base path: `/api`. JSON in / JSON out. Plural resource nouns. No versioning (single local consumer).
- Every request body/query is validated with **zod** at the handler boundary.
- Error envelope (all non-2xx): `{ "error": { "code": "<stable_string>", "message": "<human readable>", "details"?: <json> } }`.
  Codes: `validation_error` (400), `not_found` (404), `invalid_state` (409), `internal_error` (500).
  `details` is present only on `validation_error` responses (the flattened Zod error) and omitted otherwise — `internal_error` never includes `details` or a stack trace.
- No auth (single-user local MVP).
- Timestamps are ISO strings. IDs are cuid strings.

## Endpoints

### Workflows

#### `GET /api/workflows`
List workflows for the dashboard/builder.
- 200: `{ workflows: Array<{ id, name, description, stepCount, createdAt, updatedAt }> }`

#### `POST /api/workflows`
Create a workflow with its ordered steps.
- Body: `{ name: string, description?: string, steps: Array<{ type: StepType, name: string, config: Json }> }`
  (server assigns `position` from array order)
- 201: `{ workflow: Workflow & { steps: WorkflowStep[] } }`
- Errors: 400 `validation_error`

#### `GET /api/workflows/{id}`
- 200: `{ workflow: Workflow & { steps: WorkflowStep[] } }`
- Errors: 404 `not_found`

#### `PUT /api/workflows/{id}`
Replace name/description and the full ordered step list (steps re-created with new positions).
- Body: same shape as POST.
- 200: `{ workflow: Workflow & { steps: WorkflowStep[] } }`
- Errors: 400 `validation_error`, 404 `not_found`

#### `DELETE /api/workflows/{id}`
Cascades to runs/executions/evals (dev data).
- 200: `{ ok: true }`
- Errors: 404 `not_found`

### Runs

#### `POST /api/runs`
Create + enqueue a run. Returns immediately; execution is async on the worker.
- Body: `{ workflowId: string, input?: Json }`
- 202: `{ run: { id, workflowId, status: "queued", createdAt } }`
- Errors: 400 `validation_error`, 404 `not_found` (unknown workflow)

#### `GET /api/runs`
List runs (dashboard recent-runs / per-workflow filter). Polled.
- Query: `?workflowId?` `?status?` `?limit=50` (int, default 50; values are clamped to [1, 200], not rejected)
- 200: `{ runs: Array<{ id, workflowId, status, latencyMs, createdAt, finishedAt }> }`
- Errors: 400 `validation_error`

#### `GET /api/runs/{id}`
Run detail with full trace — this is the endpoint the UI polls every 2s.
- 200: `{ run: Run, steps: StepExecution[] (ordered by position), evaluations: EvaluationResult[] }`
- Errors: 404 `not_found`

#### `POST /api/runs/{id}/cancel`
Best-effort cancel (only meaningful for queued / awaiting_approval).
- 200: `{ run: Run }`
- Errors: 404 `not_found`, 409 `invalid_state` (already terminal)

### Approvals

#### `POST /api/runs/{id}/approve`
Approve the run's pending approval step; re-enqueues the run to resume.
- Body: `{ note?: string }`
- 200: `{ run: Run }`  (status returns to `queued`/`running`)
- Errors: 404 `not_found`, 409 `invalid_state` (run not `awaiting_approval`)

#### `POST /api/runs/{id}/reject`
Reject the pending approval; run terminates as `failed`.
- Body: `{ note?: string }`
- 200: `{ run: Run }`
- Errors: 404 `not_found`, 409 `invalid_state`

### Evaluations

#### `GET /api/evaluations`
List evaluation results, filterable for eval-score views and history.
- Query: `?workflowId?` `?runId?` `?evaluatorType?` `?limit=100`
- 200: `{ evaluations: Array<EvaluationResult> }`
- Errors: 400 `validation_error`

### Dashboard

#### `GET /api/dashboard`
Aggregated metrics for the landing dashboard.
- Query: `?workflowId?` (optional scope)
- 200:
```ts
{
  totals: { runs: number, succeeded: number, failed: number, successRate: number },
  avgLatencyMs: number | null,
  failedStepCount: number,
  recentRuns: Array<{ id, workflowId, status, latencyMs, createdAt }>,  // limit 10, ordered by createdAt desc
  evalScores: { deterministic: number|null, rubric: number|null, llm_judge: number|null }
}
```
- `totals.successRate = succeeded / (succeeded + failed)`, rounded to 3 decimals. `canceled` runs are deliberately excluded from both numerator and denominator — a user cancellation is not a workflow failure. `0` when there are no terminal (succeeded/failed) runs yet.
- `recentRuns` is always capped at 10 rows regardless of total run count (`RECENT_RUNS_LIMIT` in `src/app/api/dashboard/route.ts`).
- Errors: 400 `validation_error`

## API design quality gate
- [x] Every endpoint traces to a requirement (workflows CRUD, run exec/trace, approvals, evals, dashboard)
- [x] Errors use the standard envelope; no stack traces leaked (`internal_error` masks internals)
- [x] Input validated with zod; documented status codes match behavior (202 for async enqueue, 409 for bad state)
- [x] Naming consistent (plural resources, `/{id}/action` for state transitions)
