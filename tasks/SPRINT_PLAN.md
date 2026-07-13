# Sprint Plan

> The current small batch of committed work (a "sprint" here = a few focused sessions, not a ceremony).
> Sprint 1 always ends with something runnable end-to-end. Full task detail lives in `tasks/BACKLOG.md`.

## Current Sprint: none — all 4 planned sprints complete as of 2026-07-12

MVP build loop finished. See `FINAL_HANDOFF.md` (repo root) for the full verification record and
`tasks/BACKLOG.md` "Post-MVP" for what's next if this project is resumed.

## Sprint #1 — Prove the execution engine end-to-end — DONE
Target outcome: with Docker infra up + schema seeded, a workflow can be created, run via `POST /api/runs`, executed in the background worker across the LLM/tool/transform executors (pausing at an approval step), and its full trace read back via `GET /api/runs/{id}`. No frontend yet — the loop is proven via API.

- [x] T1 (M) Prisma schema + seed — R1/R2/R5/R11
- [x] T2 (M) WALKING SKELETON: runs enqueue → worker → trace loop — R3/R4/R5
- [x] T3 (S) Error envelope + zod validation scaffolding — API conventions/R3
- [x] T4 (M) Mock LLM provider + LLM_PROMPT executor — R2/R10
- [x] T5 (S) TOOL_API + TRANSFORM executors — R2
- [x] T6 (M) Runner orchestration + pause-on-approval — R2/R3/R6
- [x] T7 (M) Workflows CRUD API — R1
- [x] T8 (S) Runs list + cancel API — R3/R4/R5

Dependency order: T1 → T2 → (T3 alongside) → T4 → T5 → T6 → T7 → T8, all completed in order.

## Sprint exit checklist
- [x] All tasks done (code + tests + docs, per Definition of Done in CLAUDE.md)
- [x] App runs end-to-end locally (POST a run → worker executes → GET trace shows ordered StepExecutions, incl. a pause on approval) — live-verified, see `FINAL_HANDOFF.md`
- [x] `/review` run (Opus) — critic-red-team pass found 10 issues (B1–B10, `tasks/BUGS.md`), all fixed; security review (`docs/SECURITY_REVIEW.md`) verdict SAFE FOR LOCAL DEMO
- [x] `/update-docs` run (this pass)

## Completed Sprints

### Sprint #2 — Evaluation, approval resume, dashboard API — DONE
Outcome: backend feature-complete. Evaluators (deterministic + rubric + judge placeholder) score runs; a paused run can be approved (resumes via requeue from the first non-terminal step) or rejected; dashboard/evaluations aggregate APIs return real metrics.
Tasks: T9, T10, T11, T12, T13, T14 — all done, verified live (`FINAL_HANDOFF.md`).

### Sprint #3 — Frontend (full demo click-through) — DONE
Outcome: the 2-minute demo path works in the browser — dashboard → trace → run → approve → evaluations — with empty/loading/error states everywhere and deliberate, reduced-motion-aware Framer Motion.
Tasks: T15, T16, T17, T18, T19, T20, T21, T22, T23, T24 — all done. `npm run build` clean, 16 routes.
Deferred/not built in this sprint: light mode (dark-mode-only by design, see DECISIONS), WebSockets (polling by design).

### Sprint #4 — Tests, docs, review, handoff — DONE
Outcome: core logic covered by vitest, README + demo script written, review run, FINAL_HANDOFF + ship verdict recorded.
Tasks: T25, T26, T27, T28, T29, T30 — all done. 114/114 Vitest passing, tsc/lint clean, `app/README.md`
rewritten, `FINAL_HANDOFF.md` written, ship verdict recorded in `docs/HANDOFF.md` (SHIP for local/personal
demo; NOT cleared for public deployment).
Deferred/not built in this sprint: Playwright e2e (scoped in `docs/TEST_PLAN.md` as optional, not implemented), screenshots (placeholders only, see `FINAL_HANDOFF.md` "Recommended Next 3 Improvements").
