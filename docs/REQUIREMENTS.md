# Requirements

> Filled during Phase 3–4 (`/plan-project`). Every requirement is testable and prioritized.
> Status: FILLED — 2026-07-11. Scope pre-approved by the user in the `/start-project` spec on 2026-07-11.

## User Stories

### R1 — Create & edit workflows [MUST]
As Jason, I want to create a workflow made of ordered steps so that I can define an agent pipeline to run.
Acceptance criteria:
- [ ] Can create a workflow with a name and description; it persists in PostgreSQL and appears in the workflows list.
- [ ] Can add, reorder, edit, and delete steps within a workflow; order is preserved on reload.
- [ ] Each step has exactly one of 5 types: `LLM_PROMPT`, `TOOL_API`, `TRANSFORM`, `HUMAN_APPROVAL`, `EVALUATION`; type-specific config is editable and saved.
- [ ] Saving a workflow with zero steps is rejected with a visible validation message; the workflow is not run-able until it has ≥ 1 step.

### R2 — Five step types execute [MUST]
As Jason, I want each of the 5 step types to execute with defined behavior so that a workflow produces a realistic trace.
Acceptance criteria:
- [ ] `LLM_PROMPT` produces an output from the mock provider given its prompt/config and records a token/cost estimate placeholder.
- [ ] `TOOL_API` executes a mock tool/API call and records its output (or a simulated error).
- [ ] `TRANSFORM` applies a parsing/transform to the previous step's output and passes the result forward.
- [ ] `HUMAN_APPROVAL` halts the run in a `PAUSED_FOR_APPROVAL` state (see R6).
- [ ] `EVALUATION` runs the evaluator (see R7) and records a pass/fail + score on the run.
- [ ] Each step's output is available as input to the next step; step I/O is persisted.

### R3 — Run a workflow against an input [MUST]
As Jason, I want to run a workflow against a provided input so that I can see it execute end-to-end.
Acceptance criteria:
- [ ] From the workflow detail screen, "Run" accepts an input payload and creates a `Run` record persisted in PostgreSQL.
- [ ] Steps execute in order; each step's status transitions through `PENDING → RUNNING → SUCCESS | FAILED` (or `PAUSED_FOR_APPROVAL`).
- [ ] A failed step records its error and retry count; run terminal status is one of `SUCCESS | FAILED | REJECTED`.
- [ ] The core action (run the seeded sample workflow) is reachable in ≤ 3 clicks from app open.

### R4 — Background execution via queue [MUST]
As Jason, I want runs to execute in a background worker so that the UI stays responsive and mirrors real infra.
Acceptance criteria:
- [ ] Triggering a run enqueues a job (Redis/BullMQ); the API returns immediately with the created run in a non-terminal state.
- [ ] A worker processes the job and updates run/step status in PostgreSQL as execution progresses.
- [ ] The run detail/trace view reflects status progression without a full-app reload (poll or refresh acceptable for MVP).
- [ ] If the worker is down, the run stays visibly `QUEUED`/`PENDING` rather than silently disappearing.

### R5 — Persist every run [MUST]
As Jason, I want every run and its step results stored so that I have a durable history.
Acceptance criteria:
- [ ] Every run persists: workflow reference, input, terminal status, timestamps, and per-step records (order, type, status, input, output, latency, error, retry count, token/cost estimate).
- [ ] Runs and their steps survive an app restart and remain viewable in the runs list and trace viewer.
- [ ] Evaluation results (R7) associated with a run persist and are retrievable in eval history.

### R6 — Human-in-the-loop approval [MUST]
As Jason, I want a run to pause at an approval checkpoint and resume on my decision so that I can gate sensitive steps.
Acceptance criteria:
- [ ] When execution reaches a `HUMAN_APPROVAL` step, the run enters `PAUSED_FOR_APPROVAL` and stops advancing.
- [ ] The UI surfaces the pending approval with the step's context (input/prior output) and Approve / Reject controls.
- [ ] Approve → the run resumes from the next step and reaches a terminal status; the decision + timestamp are persisted.
- [ ] Reject → the run terminates in `REJECTED`; no further steps execute; the decision is persisted and shown in the trace.

### R7 — Evaluation framework [MUST]
As Jason, I want deterministic and rubric-based evaluation with a judge placeholder so that runs get scored and I can show eval history.
Acceptance criteria:
- [ ] Deterministic checks (e.g., contains/regex/JSON-valid/exact-match) run against a step output and return pass/fail.
- [ ] Rubric-based scoring returns a numeric score against defined criteria with a pass/fail threshold.
- [ ] An LLM-as-judge interface exists but returns a mock score in mock mode (no real model call); it is clearly labeled as a placeholder.
- [ ] Each evaluation persists its type, score, pass/fail, and target, and appears in the run's eval results and in aggregate eval history.

### R8 — Trace viewer [MUST]
As a viewer, I want a developer-grade trace of a run so that I can inspect exactly what each step did.
Acceptance criteria:
- [ ] Trace shows steps in execution order as a timeline of expandable cards.
- [ ] Each step card shows: type, status badge, latency, retry count, and token/cost estimate (labeled placeholder).
- [ ] Expanding a step reveals input and output panels; failed steps show an error panel with the error message.
- [ ] Approval steps show the decision (approved/rejected) and who/when (single user + timestamp).

### R9 — Ops dashboard [MUST]
As a viewer, I want an overview dashboard so that I can gauge system health at a glance.
Acceptance criteria:
- [ ] Dashboard shows metric cards: total runs, success rate, average latency, and count of failed steps — computed from persisted runs.
- [ ] Dashboard lists recent runs (with status + timestamp) linking to their traces.
- [ ] Dashboard shows an evaluation summary (e.g., pass rate / recent eval scores).
- [ ] With no runs yet, the dashboard shows an empty state guiding the viewer to run the sample workflow, not blank/NaN cards.

### R10 — Mock provider mode (default) [MUST]
As a viewer, I want the whole demo to work with no API keys so that I can run it instantly and for free.
Acceptance criteria:
- [ ] Mock provider is the default; running the app requires no LLM API key.
- [ ] Mock LLM/tool responses are realistic and produce varied outputs, latencies, and occasional simulated failures so traces/retries look authentic.
- [ ] A real-provider interface exists as a placeholder/stub but is not required and not wired to any paid service.

### R11 — Seed data & sample workflow [MUST]
As a viewer, I want the app pre-populated so that the demo is compelling on first open.
Acceptance criteria:
- [ ] A seed command populates ≥ 1 polished sample workflow that exercises multiple of the 5 step types (including approval and evaluation).
- [ ] Seed data includes example runs (at least one success, one failure, one with an approval decision) and eval results so the dashboard and trace views are non-empty on first launch.
- [ ] Seeding is idempotent enough to re-run for a clean demo (documented reset path).

### R12 — Polished frontend states [MUST]
As a viewer, I want empty/loading/error/success states everywhere so that the product feels production-grade.
Acceptance criteria:
- [ ] App shell present on every screen: sidebar nav, top bar, and a run/queue status indicator.
- [ ] Every data-backed view defines empty, loading (skeleton), error, and success states.
- [ ] Framer Motion is used deliberately (entrances, expand/collapse, status transitions, skeletons, modals) and respects `prefers-reduced-motion`.
- [ ] Layout is usable and correct at laptop and desktop widths.

### R13 — Tests for core logic [MUST]
As Jason, I want tests on the risky core so that behavior is locked and demonstrable.
Acceptance criteria:
- [ ] Workflow runner: happy-path ordered execution, a failure/retry path, and pause-on-approval are covered.
- [ ] Evaluator: deterministic check pass & fail, and rubric scoring threshold behavior are covered.
- [ ] Core API logic: create workflow, trigger run, and submit approval decision are covered including one failure/validation case each.
- [ ] `vitest` suite passes locally.

### R14 — Docs & demo script [SHOULD]
As a viewer/Jason, I want README + docs + demo script so that the project is understandable and self-serve.
Acceptance criteria:
- [ ] README covers setup (Docker Compose infra + app run), the mock-mode note, and a 2-minute demo script.
- [ ] Docs list known limitations and include resume bullets.
- [ ] A new person can run the demo from docs alone.

## Non-Functional Requirements
- **NFR1 [MUST]** Zero paid dependencies / no API key required to run the full demo (enforces $0 budget).
- **NFR2 [MUST]** Single deployable app (`app/`) + Docker Compose for Postgres/Redis only; no microservices.
- **NFR3 [SHOULD]** Runs list and dashboard load in < 2s with ≥ 50 seeded runs on a laptop.
- **NFR4 [SHOULD]** Trace view renders a run with ≥ 8 steps without layout breakage.
- **NFR5 [MUST]** No auth, no multi-user, no PII; all data is disposable demo data.
- **NFR6 [SHOULD]** `prefers-reduced-motion` disables non-essential animation.

## MVP Scope (LOCKED)
> Max 7 user-facing capabilities. Scope pre-approved by the user in the `/start-project` spec (the 13 user-locked core requirements). Any later change = major scope change = human checkpoint.

| # | Capability | Requirement IDs |
|---|---|---|
| 1 | Author workflows as an ordered list of steps (5 step types) | R1, R2 |
| 2 | Run a workflow against an input, executed in a background worker | R3, R4 |
| 3 | Mock provider mode so runs work locally with no API keys | R10 |
| 4 | Human-in-the-loop approval: pause, decide in UI, resume/reject | R6 |
| 5 | Developer-grade trace viewer over persisted runs | R5, R8 |
| 6 | Evaluation framework (deterministic + rubric + judge placeholder) with stored history | R7 |
| 7 | Ops dashboard + seeded polished demo, with full empty/loading/error states | R9, R11, R12 |

Cross-cutting MUSTs that support all seven (not separate user-facing capabilities): R13 (tests), NFR1–NFR6. R14 (docs) is SHOULD.

**Red-team note:** Critic pass attempted further cuts. Approval (R6), evaluation (R7), and the queue (R4) are each defensible under the anti-overbuilding rules only because they are the *explicit core value* of an "AI ops / observability" resume project — they are what the artifact exists to prove — and were user-locked. They are NOT speculative. Nothing outside these 7 (auth, multi-user, real providers, canvas builder, deployment, alerting, settings) is in scope.

**Approved by user on:** 2026-07-11 (pre-approved via `/start-project` spec; the 13 user-locked core requirements constitute written approval of this scope).

## Deferred (Post-MVP)
> Logged to `tasks/BACKLOG.md` "Post-MVP" by project-coordinator. Listed here for traceability.
- Real/paid LLM provider integration (wire the placeholder to OpenAI/Anthropic) — human checkpoint (paid + external API).
- Authentication and multi-user / multi-tenant workspaces.
- Drag-and-drop canvas / DAG workflow builder (branches, parallel steps).
- Public/cloud deployment + CI/CD pipeline.
- Real LLM-as-judge evaluation (replace mock judge with a model call).
- Alerting/notifications, scheduling/cron, webhooks.
- Real-time cost/budget tracking and enforcement (beyond estimate placeholders).
- Settings/admin/analytics screens beyond the single ops dashboard.
- Mobile/phone-optimized responsive layouts.
