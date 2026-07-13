---
description: "Phase 3-8: requirements, MVP scope lock, architecture, data model, UX, task breakdown"
argument-hint: (no arguments — reads docs/PROJECT_BRIEF.md)
---

# /plan-project — Full Planning Loop

**Recommended model: Opus.** If not Opus, warn once and offer to continue anyway.

Precondition: `docs/PROJECT_BRIEF.md` is filled and user-approved. If it's still the template, tell the user to run `/start-project` first and stop.

Follow `prompts/PLANNING_LOOP.md` through all six steps, honoring each phase's exit criteria and quality gates from `prompts/MASTER_AGENTIC_LOOP.md`:

1. Requirements → `docs/REQUIREMENTS.md`
2. MVP scope lock → red-team it, then **PAUSE for user approval of the locked scope** (mandatory)
3. Architecture → `docs/ARCHITECTURE.md` (+ stack decision in `docs/DECISIONS.md`); flag any paid/external service to the user
4. Data model → `docs/DATA_MODEL.md`
5. UX flows → `docs/UX_FLOW.md`
6. Task breakdown → `tasks/BACKLOG.md`, `tasks/SPRINT_PLAN.md`, `tasks/NEXT_ACTIONS.md`, `tasks/RISKS.md` (Task 1 = walking skeleton)

Run the final self-check in the planning prompt. End with: scope summary, stack, first 3 tasks, and "Switch to Sonnet (`/model sonnet`) and run `/build-next`."
