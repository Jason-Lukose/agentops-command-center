# PLANNING LOOP PROMPT (Phases 3–8: Requirements → Task Breakdown)

**Recommended model: Opus.** Roles: product-manager → critic-red-team → technical-architect → database-engineer → project-coordinator.

Input: an approved `docs/PROJECT_BRIEF.md`. Output: a complete, buildable plan. Work through the phases in order; consult `prompts/MASTER_AGENTIC_LOOP.md` for each phase's exit criteria and quality gate.

## 1. Requirements (→ `docs/REQUIREMENTS.md`)
Write user stories with IDs (R1, R2...), acceptance criteria, and MoSCoW priority. Every acceptance criterion must be verifiable by a test or a manual check. Non-functional requirements only where they matter for MVP (e.g., "works on mobile browser" yes; "99.9% uptime" no).

## 2. MVP Scope Lock (→ REQUIREMENTS.md "MVP Scope (LOCKED)")
List ONLY the Must-haves — max 7 user-facing capabilities. Then **red-team your own scope**: for each item ask "does the core value die without this?" If no → move to `tasks/BACKLOG.md` Post-MVP. Auth, settings, admin, analytics are Post-MVP by default. **STOP and get user approval of the locked scope before continuing.** This is the one mandatory pause in planning.

## 3. Architecture (→ `docs/ARCHITECTURE.md`, decisions → `docs/DECISIONS.md`)
Choose the simplest stack you'd bet on: prefer boring, popular, well-documented (e.g., Next.js full-stack, or Python + FastAPI + SQLite, or plain Node + Express — match to the project and to what the user already knows if stated). One deployable unit. Describe: components, data flow (one diagram in ASCII), project folder layout, how to run locally. Justify each major choice in ≤ 3 sentences. Flag any external API or paid service — that's a human checkpoint.

## 4. Data Model (→ `docs/DATA_MODEL.md`)
Entities, fields, types, constraints, relations — only what MVP stories need. State the storage choice and the migration story ("pre-launch: drop and recreate").

## 5. UX Flow (→ `docs/UX_FLOW.md`)
For each MVP story: the screen-by-screen (or step-by-step) flow, including empty state, loading state, and error state. Screen inventory at the end. No screens without a story.

## 6. Task Breakdown (→ `tasks/BACKLOG.md`, `tasks/SPRINT_PLAN.md`, `tasks/NEXT_ACTIONS.md`, `tasks/RISKS.md`)
Slice vertically. **Task 1 is always the walking skeleton**: the chosen stack running locally with one trivial end-to-end path (page loads → calls API → touches store). Each task: ID, title, requirement ID it serves, acceptance criteria, rough size (S/M), file hints. Order so every task leaves the app runnable. Sprint 1 = walking skeleton + the single most valuable story. Populate `tasks/NEXT_ACTIONS.md` with the first 3 tasks. Log top 3–5 risks with mitigations in `tasks/RISKS.md`.

## Final self-check before finishing
- [ ] Every MVP capability has requirements, data, UX flow, and tasks
- [ ] Anti-overbuilding rules (CLAUDE.md) all pass
- [ ] No task > ~2 hours; no horizontal slicing
- [ ] All paid/external dependencies flagged to the user
- [ ] `docs/DECISIONS.md` records stack choice with rationale

End by telling the user: scope summary, stack, first 3 tasks, and: "Switch to Sonnet (`/model sonnet`) and run `/build-next` to start building."
