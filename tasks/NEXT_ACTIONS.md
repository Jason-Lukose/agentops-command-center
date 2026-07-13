# Next Actions

> The immediate queue — top item is what `/build-next` picks up. Keep it to ≤ 3 items; refill from SPRINT_PLAN.md.
> One task in progress at a time (per delegated engineer).

## Queue

> All queued items from the build loop are done — see "Done" below and `FINAL_HANDOFF.md` at the repo
> root for the full verification record. Next work (if resumed) starts from `tasks/BACKLOG.md`
> "Post-MVP" or `FINAL_HANDOFF.md` → "Recommended Next 3 Improvements".

- [x] **Backend verification gate** — `tsc`, `vitest` (114/114), lint, and the live e2e (POST run → worker → trace → approve → GET) all confirmed passing; findings logged and fixed in `tasks/BUGS.md` (B1–B10, all FIXED).
- [x] **Frontend verification gate** — `npm run build` succeeds (16 routes), demo path click-through verified live, empty/loading/error states present per UX_FLOW.
- [x] **Sprint 4** — qa-tester hardening pass done (`tasks/BUGS.md` fix log), README/demo script written (documentation-writer, `app/README.md`), doc-sync pass done (ARCHITECTURE/DATA_MODEL/API_SPEC/DEPLOYMENT/TEST_PLAN drift fixed). Formal review verdicts are reflected in `docs/SECURITY_REVIEW.md` (SAFE FOR LOCAL DEMO) and `tasks/BUGS.md` (red-team pass, all findings fixed). `FINAL_HANDOFF.md` written at the repo root.

## In Progress
- (none — MVP build loop complete as of 2026-07-12)

## Done (this session)
- **T1 schema + seed** — `prisma/schema.prisma` (Prisma 7 + pg adapter), migration `20260712025916_init` applied, seed verified in Postgres: 2 workflows / 10 steps / ~16 runs / ~84 step executions / ~15 eval results (seed-only baseline; the live DB at final handoff has more rows from verification runs layered on top — see `FINAL_HANDOFF.md` for exact live counts).
- Docker Desktop installed by user; compose runs Postgres on host port **5433** (5432 was taken by a pre-existing native Postgres — see DECISIONS).
- **Sprints 1–2 (backend)** — runner, executors (5 types), mock provider, evaluators (3 types), BullMQ queue+worker, all API routes, unit tests. Verified live against Postgres :5433 / Redis :6379.
- **Sprint 3 (frontend)** — app shell, dashboard, workflows list/builder, runs, trace viewer, evaluations, motion system per docs/UX_FLOW.md design system. `npm run build` clean.
- **Sprint 4** — bug-fix pass (B3–B10, `tasks/BUGS.md`), README + FINAL_HANDOFF.md (documentation-writer), doc-sync (ARCHITECTURE/DATA_MODEL/API_SPEC/DEPLOYMENT/TEST_PLAN drift fixed).

## Blocked
- (none)

## Notes for backend-engineer (from frontend-engineer, non-blocking)
- `GET /api/runs/{id}` steps (`StepExecution[]`) don't include the step's `type`/`name` (matches DATA_MODEL — no join to `WorkflowStep`). The trace viewer currently works around this by separately fetching `GET /api/workflows/{workflowId}` and joining `stepId -> {type, name}` client-side. Functionally fine, but consider denormalizing `type`/`name` onto the trace response later to save the extra request — not required for MVP.
- `GET /api/workflows` (`WorkflowSummary`) doesn't include step types, only `stepCount`, so the workflows-list "step-type icon strip" from UX_FLOW's component vocabulary is omitted on that screen (only shown expanded in the builder/detail view where full `WorkflowStep[]` is available). Non-blocking cosmetic gap.
