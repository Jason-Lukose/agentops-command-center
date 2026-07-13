# Handoff

> Filled during Phase 16 (`prompts/FINAL_HANDOFF.md`). The test: could someone with zero context on this
> conversation run, deploy, and extend the project from this doc + the repo? Honesty over polish.
> Status: **FILLED — 2026-07-12.** The full handoff document is `FINAL_HANDOFF.md` at the repo root — read
> that first. This file is a short pointer + session summary; it does not duplicate the detail.

## What Was Built
All 7 locked MVP capabilities (`docs/REQUIREMENTS.md`) are built and verified: workflow authoring (5 step
types), queue-backed background execution, mock-provider mode (zero API keys), human-in-the-loop approval,
a developer-grade trace viewer, a 3-mode evaluation framework, and an ops dashboard with a seeded demo.
Full detail + verification evidence: `FINAL_HANDOFF.md` → "What Was Built" / "What Is VERIFIED".

## What Was NOT Built
Real LLM provider integration, public deployment, Playwright e2e, light mode, WebSockets, and captured
screenshots — see `FINAL_HANDOFF.md` → "What Was NOT Done / Incomplete" for the full, honest list.

## How to Run / Deploy / Roll Back
See `app/README.md` "Quickstart" and `docs/ARCHITECTURE.md` "Running Locally" (dev-only, local-first;
`docs/DEPLOYMENT.md` documents a future path — nothing is deployed).

## File Map
- `app/src/lib/` — runner, executors (5 step types), providers (mock), evaluators (3 types), validation, errors
- `app/src/worker/index.ts` — BullMQ worker entrypoint
- `app/src/app/api/**` — REST route handlers (workflows, runs, approve/reject, evaluations, dashboard)
- `app/src/app/**` (non-api) + `app/src/components/` — UI (dashboard, workflows, runs, trace viewer, evaluations)
- `app/prisma/schema.prisma` + `app/prisma/seed.ts` — data model + seed data
- `app/src/lib/__tests__/`, `app/src/app/api/__tests__/` — 114 Vitest tests

## Open Bugs & Top Risks
`tasks/BUGS.md`: all 10 findings (B1–B10) are **FIXED** as of 2026-07-12, with regression tests. No open
bugs at handoff. `docs/SECURITY_REVIEW.md`: 3 accepted-as-documented Low findings (no body-size limit, no
step-count cap, no rate limiting) — all self-inflicted-only in the single-user local model; not blockers.

## Recommended Next 3 Steps
1. Capture real screenshots + a demo GIF for `app/README.md` (placeholders exist in `app/docs/screenshots/`).
2. Add one real LLM provider behind `PROVIDER_MODE`, gated by the external-API human checkpoint.
3. Add a Playwright e2e test of the guided demo path (create → run → approve → view trace + evals).

## Resuming Work With This Kit
Open Claude Code in this directory. For new features: add to `tasks/BACKLOG.md`, run `/plan-project` if scope changes materially, otherwise `/build-next` (Sonnet). For bugs: `/debug <issue>`. Before any deploy: `/ship-check` (Opus).

## Ship Verdict
**SHIP (for local/personal demo use).** 114/114 tests, `tsc`/lint/build clean, live e2e approval lifecycle
verified, security review SAFE FOR LOCAL DEMO (no High/Medium findings). **NOT cleared for public/internet
deployment** — that requires auth + hardening + a separate human-approved deploy step (see
`docs/SECURITY_REVIEW.md`, `docs/DEPLOYMENT.md`). Recorded 2026-07-12; see `docs/DECISIONS.md` for the
underlying decisions this verdict rests on.
