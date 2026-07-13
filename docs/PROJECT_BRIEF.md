# Project Brief

> Filled during Phase 1–2 (`/start-project`). Source of truth for WHY this project exists.
> Status: FILLED — 2026-07-11.

## Problem
AI/ML platform teams run multi-step agent workflows (chained LLM calls, tool calls, parsing, evaluations) with almost no visibility into what happened inside a run. When a run fails, is slow, or produces a bad answer, there is no per-step trace, no latency/cost breakdown, no evaluation history, and no clean way to pause for human approval mid-run. Existing tools (LangSmith, internal ops dashboards, Zapier-style orchestrators) each solve a slice and are heavyweight, paid, and cloud-hosted. Separately, a CS student targeting SWE/AI/platform internships has no compact, self-contained artifact that credibly demonstrates production-grade AI-infrastructure skills plus polished product design in a single runnable repo.

## Target User
Two concrete users, both first-class:
1. **Recruiter / hiring engineer** evaluating Jason — lands on the repo or a local demo, needs to grasp "this person can build real AI infrastructure" within ~2 minutes of clicking, without setup friction or API keys.
2. **Jason (builder/operator)** — designs sample workflows, runs them locally, inspects traces, and reviews evaluation results to demonstrate the platform end-to-end.

## Core Value
A recruiter (or Jason) uses AgentOps Command Center to run a multi-step AI agent workflow locally and see a production-grade trace, evaluation scores, and ops dashboard — proving AI-infrastructure + product skill in one runnable, $0, no-API-key demo.

## Success Criteria
1. From a clean clone, the demo runs locally (infra via Docker Compose, app in `app/`) and a seeded sample workflow executes end-to-end in mock provider mode with **no paid API key**.
2. A viewer can start from the dashboard, run the sample workflow, open its trace, and view its evaluation results in **≤ 3 clicks** to the core action (run a workflow).
3. A run that includes a human-approval step **pauses**, is resumable via the UI (approve → resumes, reject → terminates), and the resulting state is persisted in PostgreSQL and visible in the trace.
4. The trace viewer shows, per step: order, status, input/output, latency, error (if any), retry count, and token/cost estimate placeholders — for every completed run.
5. Tests for the workflow runner, evaluator, and core API logic pass locally (`vitest`).

## Explicitly NOT Doing
- Real/paid LLM provider integration (mock provider is the default and the only shipped provider; real providers are a placeholder interface only).
- Authentication, accounts, or multi-user/multi-tenant support (single-user, local-first).
- Drag-and-drop canvas / graph workflow builder (MVP uses an ordered step-list editor only).
- Public/cloud deployment, hosting, or CI/CD pipelines (local run only).
- Real-time cost billing or budget enforcement (cost/token figures are labeled estimates/placeholders).
- Alerting, notifications, scheduling/cron, or webhooks.
- Settings pages, admin panels, or analytics beyond the single ops dashboard defined in requirements.

## Assumptions
- ASSUMPTION: The audience will judge quality by (a) a 2-minute guided click-through of the seeded demo and (b) code/README skim — so a polished, fully-working local demo matters more than breadth of features.
- ASSUMPTION: The reviewer runs the app locally following the README (Docker Compose for Postgres + Redis, then the Next.js app); no hosted URL is required.
- ASSUMPTION: Mock provider mode must produce deterministic-enough, realistic-looking outputs (including occasional simulated failures/latency) so traces, retries, and eval results look authentic without real API calls.
- ASSUMPTION: "Evaluation" for MVP means deterministic checks + rubric-based scoring that run in-process; LLM-as-judge is a stubbed interface returning mock scores, not a real model call.
- ASSUMPTION: Token/cost figures are computed estimates or static placeholders, clearly labeled as such — not billed values.
- ASSUMPTION: Single user, no auth, no PII; all data is seed/demo data safe to delete and recreate.
- ASSUMPTION: Target hardware is a laptop/desktop browser; responsive down to laptop width, not phone-optimized.
- ASSUMPTION: The stack (Next.js App Router + TS + Tailwind + Framer Motion + Postgres + Prisma + Redis + BullMQ + Docker Compose infra + Vitest) is user-dictated and fixed; the architect works within it rather than re-selecting it.

## Constraints
- Budget: $0 — no paid services, no API keys, no hosting (per CLAUDE.md human checkpoints).
- Timeline: Resume/portfolio project; no fixed external deadline, but MVP must stay small (≤ 7 capabilities) to actually ship.
- Platform: Local-first web app. Next.js app lives in `app/`; PostgreSQL + Redis run via Docker Compose (infra only). One deployable unit.
- Existing accounts/tools: None required. Must run without signing up for anything.
