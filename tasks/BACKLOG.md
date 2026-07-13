# Backlog

> All known work, prioritized. Filled at Phase 8, appended forever. Tasks flow: BACKLOG → SPRINT_PLAN → NEXT_ACTIONS → done.

## Task format
```
- [ ] T<id> (S|M) <title> — serves R<id>
      Accept: <criteria>. Files: <hints>.
```
Rules: every task ≤ ~2h (split M before starting), vertical slices, traces to a requirement.
Sizing: S ≈ ≤1h, M ≈ ~2h. Anything bigger must be split before it enters NEXT_ACTIONS.

## MVP

### Sprint 1 — Execution engine + walking skeleton (backend, API-drivable)

- [ ] T1 (M) Prisma schema + seed script — serves R1, R2, R5, R11 · **owned by database-engineer (in progress, parallel)**
      Accept: `schema.prisma` matches docs/DATA_MODEL.md (5 enums, Workflow/WorkflowStep/Run/StepExecution/EvaluationResult, indexes, cascades); `npx prisma migrate dev` succeeds; `npm run seed` creates ≥1 polished sample workflow exercising multiple step types + example runs (≥1 success, ≥1 failure, ≥1 approved) + eval results; re-runnable (reset path documented). Files: `prisma/schema.prisma`, `prisma/seed.ts`.

- [ ] T2 (M) WALKING SKELETON — runs enqueue → worker → trace loop — serves R3, R4, R5
      Accept: `POST /api/runs {workflowId,input}` creates a `Run` (queued), enqueues `{runId}` to BullMQ, returns 202; `worker.ts` consumes the job, runs a minimal runner over a trivial single-step workflow, writes one `StepExecution`, sets `Run.status=succeeded`; `GET /api/runs/{id}` returns `{run, steps, evaluations}`. Proven live: `npm run dev` + `npm run worker`, POST a run → it reaches `succeeded` → GET reflects the trace. Files: `src/lib/db.ts`, `src/lib/queue.ts`, `src/worker.ts`, `src/core/runner.ts`, `src/app/api/runs/route.ts`, `src/app/api/runs/[id]/route.ts`.

- [ ] T3 (S) Error envelope + zod validation scaffolding — serves API_SPEC conventions, R3
      Accept: `lib/errors.ts` returns `{error:{code,message}}` for `validation_error`(400)/`not_found`(404)/`invalid_state`(409)/`internal_error`(500); run-create body validated with zod (invalid → 400, unknown workflow → 404); no stack traces leaked. Files: `src/lib/errors.ts`, `src/lib/validation/runs.ts`.

- [ ] T4 (M) Mock LLM provider + LLM_PROMPT executor — serves R2, R10
      Accept: `Provider` interface + `MockLLMProvider` producing varied outputs, variable latency, and occasional simulated failures; token/cost placeholders populated; real-provider stub exists but is NOT wired to any network/paid service; `LLM_PROMPT` executor writes a `StepExecution` (output, tokensIn/Out, costEstimate, latencyMs). Files: `src/core/providers/index.ts`, `src/core/providers/mock.ts`, `src/core/executors/llmPrompt.ts`.

- [ ] T5 (S) TOOL_API + TRANSFORM executors — serves R2
      Accept: `TOOL_API` executes a mock tool call recording output or a simulated error; `TRANSFORM` applies a parse/transform to the previous step's output and passes result forward; step I/O persisted and chained to the next step. Files: `src/core/executors/toolApi.ts`, `src/core/executors/transform.ts`.

- [ ] T6 (M) Runner orchestration: status transitions, chaining, retry, pause-on-approval — serves R2, R3, R6(pause)
      Accept: steps execute in `position` order, each transitions `pending→running→succeeded|failed`; each step's output is the next step's input; failed step records `errorMessage`+`retryCount`; run reaches terminal `succeeded|failed` with `finishedAt`+`latencyMs`; an `approval` step sets `Run.status=awaiting_approval`, writes a `StepExecution` with `status=awaiting_approval`, and stops the job cleanly (no busy-wait). Files: `src/core/runner.ts`, `src/core/executors/approval.ts`.

- [ ] T7 (M) Workflows CRUD API — serves R1
      Accept: `GET/POST/GET{id}/PUT/DELETE /api/workflows` per docs/API_SPEC.md; zod-validated; server assigns `position` from array order; zero-steps save rejected 400 `validation_error`; unknown id → 404; PUT replaces the full ordered step list; DELETE cascades. Files: `src/app/api/workflows/route.ts`, `src/app/api/workflows/[id]/route.ts`, `src/lib/validation/workflows.ts`.

- [ ] T8 (S) Runs list + cancel API — serves R3, R4, R5
      Accept: `GET /api/runs?workflowId?&status?&limit=50(max 200)`; `POST /api/runs/{id}/cancel` best-effort (409 if already terminal); worker-down leaves a run visibly `queued` (never silently dropped). Files: `src/app/api/runs/route.ts`, `src/app/api/runs/[id]/cancel/route.ts`.

### Sprint 2 — Evaluation framework, approval resume, dashboard API (backend complete)

- [ ] T9 (M) Deterministic + rubric evaluators — serves R7
      Accept: deterministic checks (contains/regex/json-valid/exact-match) return pass/fail; rubric scoring returns numeric score vs a pass/fail threshold; each writes `EvaluationResult` (evaluatorType, score 0–1, passed, details). Files: `src/core/evaluators/deterministic.ts`, `src/core/evaluators/rubric.ts`, `src/core/evaluators/index.ts`.

- [ ] T10 (M) LLM-judge placeholder + EVALUATION executor — serves R7, R2
      Accept: `llm_judge` interface returns a mock score in mock mode, clearly labeled placeholder, NO real model call; `EVALUATION` executor runs the configured evaluator against a target step output, writes `EvaluationResult`, records pass/fail+score on the run. Files: `src/core/evaluators/llmJudge.ts`, `src/core/executors/evaluation.ts`.

- [ ] T11 (M) Approve/reject API + resume via requeue — serves R6
      Accept: `POST /api/runs/{id}/approve` flips the pending approval `StepExecution` to `succeeded`, sets `approvalDecidedAt`, re-enqueues `{runId}`; `POST /api/runs/{id}/reject` terminates the run `failed` (REJECTED semantics), no further steps; both 409 `invalid_state` if run not `awaiting_approval`, 404 if unknown; decision + timestamp persisted. Files: `src/app/api/runs/[id]/approve/route.ts`, `src/app/api/runs/[id]/reject/route.ts`.

- [ ] T12 (S) Runner resume correctness — serves R6
      Accept: on re-enqueue the runner resumes from the first non-terminal `StepExecution`; already-`succeeded` steps are not re-run; behavior is idempotent if the job is delivered twice (no duplicate executions). Files: `src/core/runner.ts`.

- [ ] T13 (S) Evaluations list API — serves R7
      Accept: `GET /api/evaluations?workflowId?&runId?&evaluatorType?&limit=100` returns filtered `EvaluationResult[]`; invalid query → 400. Files: `src/app/api/evaluations/route.ts`.

- [ ] T14 (M) Dashboard metrics API — serves R9
      Accept: `GET /api/dashboard?workflowId?` returns totals(runs/succeeded/failed/successRate), avgLatencyMs, failedStepCount, recentRuns, evalScores{deterministic,rubric,llm_judge}; empty DB returns zeros/nulls per spec, never NaN. Files: `src/app/api/dashboard/route.ts`.

### Sprint 3 — Frontend (full demo click-through in browser)

- [ ] T15 (M) App shell + SWR + motion base — serves R12, NFR6
      Accept: sidebar nav (Dashboard/Workflows/Runs/Evaluations), top bar with mock-mode badge + run/queue status indicator, usable at laptop+desktop widths; SWR fetcher wired; Framer Motion base config honors `prefers-reduced-motion`. Files: `src/app/(dashboard)/layout.tsx`, `src/components/shell/*`, `src/lib/swr.ts`, `src/lib/motion.ts`.

- [ ] T16 (M) Dashboard screen — serves R9, R11, R12
      Accept: metric cards (total runs, success rate, avg latency, failed steps), recent runs list linking to traces, eval summary; empty/loading(skeleton)/error states; "Run sample workflow" CTA; never NaN/blank. Files: `src/app/(dashboard)/page.tsx`, `src/components/dashboard/*`.

- [ ] T17 (S) Workflows list + create entry — serves R1, R12
      Accept: list with stepCount, "New workflow" opens builder; empty/loading/error states. Files: `src/app/(dashboard)/workflows/page.tsx`, `src/components/workflows/*`.

- [ ] T18 (M) Workflow builder/detail — serves R1, R2, R3
      Accept: name/description fields; add/reorder(up-down)/edit/delete steps across all 5 types with type-specific config panels; Save with zero-steps validation banner (keeps form data); Run action appears on saved workflow. Files: `src/app/(dashboard)/workflows/[id]/page.tsx`, `src/components/builder/*`.

- [ ] T19 (S) Run trigger flow + input modal — serves R3, R4, R10
      Accept: Run → input modal pre-filled with sample input → confirm enqueues + navigates to the new run's trace; ≤3 clicks from app open. Files: `src/components/run/RunModal.tsx`.

- [ ] T20 (S) Runs list screen — serves R3, R5
      Accept: history with status badge + timestamp, rows link to trace; empty ("No runs yet" CTA)/loading/error states. Files: `src/app/(dashboard)/runs/page.tsx`.

- [ ] T21 (M) Trace viewer — serves R5, R8, R12, NFR4
      Accept: expandable step cards in execution order; each shows type, status badge, latency, retryCount, token/cost placeholder (labeled); expand → input/output panels; failed steps show error panel; polls `GET /api/runs/{id}` on 2s SWR until terminal; ≥8 steps without layout breakage; Framer expand/collapse. Files: `src/app/(dashboard)/runs/[id]/page.tsx`, `src/components/trace/*`.

- [ ] T22 (S) Approval interaction panel — serves R6
      Accept: `awaiting_approval` run shows an Approval-required panel with step input/prior output + Approve/Reject; buttons disable+spinner during decision; resume/reject reflected on refresh; submit error keeps run paused and re-enables buttons. Files: `src/components/trace/ApprovalPanel.tsx`.

- [ ] T23 (S) Evaluations view — serves R7, R5
      Accept: aggregate pass rate + recent scores + list of eval results linked to runs; clicking a result opens that run's trace with the eval step expanded; empty/loading/error states. Files: `src/app/(dashboard)/evaluations/page.tsx`, `src/components/evaluations/*`.

- [ ] T24 (S) Framer Motion polish + a11y/reduced-motion pass — serves R12, NFR6
      Accept: deliberate entrances, expand/collapse, status transitions, skeletons, modal transitions; `prefers-reduced-motion` disables non-essential animation everywhere; modal focus-trap + keyboard/escape. Files: `src/components/**`, `src/lib/motion.ts`.

### Sprint 4 — Tests, docs, review, handoff

- [ ] T25 (M) Runner tests — serves R13
      Accept: happy-path ordered execution, a failure/retry path, and pause-on-approval each covered; tests fail when the runner is broken. Files: `tests/core/runner.test.ts`.

- [ ] T26 (S) Evaluator tests — serves R13
      Accept: deterministic check pass & fail, rubric scoring threshold behavior covered. Files: `tests/core/evaluators.test.ts`.

- [ ] T27 (M) Core API tests — serves R13
      Accept: create workflow, trigger run, and submit approval decision covered, each including one failure/validation case; `vitest` suite passes. Files: `tests/api/*.test.ts`.

- [ ] T28 (M) README + demo script + docs sync — serves R14
      Accept: README covers Docker Compose infra + app+worker run + mock-mode note + 2-minute demo script; docs list known limitations + resume bullets; API_SPEC/DATA_MODEL/ARCHITECTURE match built code. Files: `README.md`, `docs/*.md`, `docs/CHANGELOG.md`.

- [ ] T29 (M) `/review` pass (Opus) + address High findings — serves Phase 11 gate
      Accept: review checklist run; findings severity-rated in `tasks/BUGS.md`; no High-severity finding left unaddressed. Files: `tasks/BUGS.md`, `tasks/NEXT_ACTIONS.md`.

- [ ] T30 (S) FINAL_HANDOFF.md + ship verdict — serves Phase 16
      Accept: handoff doc (what was built, how to run, known issues, deferred items, next steps); SHIP/NO-SHIP recorded in `docs/DECISIONS.md`. Files: `docs/FINAL_HANDOFF.md`, `docs/DECISIONS.md`.

## Post-MVP
> Overbuilding temptations wait here. Nothing built without user approval; several are human checkpoints.
- Real/paid LLM provider integration (wire the Provider stub to OpenAI/Anthropic) — human checkpoint (paid + external API + API key).
- Real LLM-as-judge evaluation (replace mock judge with a model call) — human checkpoint.
- Authentication + multi-user / multi-tenant workspaces — human checkpoint (auth decision).
- Drag-and-drop canvas / DAG workflow builder (branches, parallel steps).
- Real-time updates via WebSockets/SSE (replace 2s polling).
- Public/cloud deployment + CI/CD pipeline — human checkpoint (public deployment).
- Playwright e2e over the demo path — STRETCH (defer unless time remains in Sprint 4).
- Alerting/notifications, scheduling/cron, webhooks.
- Real cost/budget tracking + enforcement (beyond estimate placeholders).
- Settings/admin/analytics screens beyond the single ops dashboard.
- Mobile/phone-optimized responsive layouts.
- Repository/service abstraction layer (only once a second data backend exists).

## Icebox
<!-- Ideas with no current intent to build. -->
