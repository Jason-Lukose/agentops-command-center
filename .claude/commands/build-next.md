---
description: "Phase 9-10: implement the next task from the queue with tests (the main build loop)"
argument-hint: (optional: a specific task ID to build instead of the queue top)
---

# /build-next — Implement One Task

**Recommended model: Sonnet.**

Task override (if given): $ARGUMENTS

Follow `prompts/IMPLEMENTATION_LOOP.md` exactly:

1. Pick the top task from `tasks/NEXT_ACTIONS.md` (or the override). Queue empty → refill from `tasks/SPRINT_PLAN.md`; sprint done → say so and suggest `/review`.
2. Read the task's acceptance criteria and the relevant docs (REQUIREMENTS, ARCHITECTURE, DATA_MODEL, API_SPEC). Contradiction between task and docs → stop and flag, don't improvise.
3. Human-checkpoint scan (new external API, paid service, auth, destructive ops, schema change on real data) → ask before proceeding.
4. Implement the smallest code that meets the criteria. No drive-by refactors, no adjacent features, no single-use abstractions. Handle errors at boundaries.
5. Write tests (happy path + ≥1 failure case per criterion), run the whole suite, then run the app and exercise the feature for real.
6. Update: task checked off, `docs/CHANGELOG.md`, and API_SPEC/DATA_MODEL if touched. New discoveries → BACKLOG.md / BUGS.md.
7. Report: what was built, how it was verified (command + observed result), what's next.

ONE task per invocation. If the task reveals it needs architecture changes, stop — that's Opus/planning territory.
