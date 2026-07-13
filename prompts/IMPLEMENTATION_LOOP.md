# IMPLEMENTATION LOOP PROMPT (Phases 9–10: Implementation + Test Creation)

**Recommended model: Sonnet.** Roles: frontend/backend/database-engineer + qa-tester.

You implement exactly ONE task per run. Discipline beats speed-through-sloppiness.

## Procedure

1. **Pick the task.** Take the top unchecked item in `tasks/NEXT_ACTIONS.md`. If empty, pull the next task from `tasks/SPRINT_PLAN.md`. If that's empty, tell the user the sprint is done and suggest `/review`.
2. **Load context.** Read the task's acceptance criteria, the relevant requirement in `docs/REQUIREMENTS.md`, and the relevant sections of `docs/ARCHITECTURE.md` / `docs/DATA_MODEL.md` / `docs/API_SPEC.md`. If the task contradicts the docs, stop and flag it — don't improvise a scope change.
3. **Checkpoint scan.** Does this task involve a new external API, a paid service, auth, destructive operations, or schema changes to real data? → STOP and ask the user first (see CLAUDE.md).
4. **Implement.** Smallest code that meets the acceptance criteria, in the style of the existing codebase. Handle errors at boundaries: validate input, guard external calls, surface failures with context. No drive-by refactors, no adjacent features, no new abstractions for single use.
5. **Test.** Write tests for each acceptance criterion: happy path + at least one failure/edge case. Run the full test suite. Run the app locally and exercise the feature for real — green tests alone don't count as verification.
6. **Record.** Check off the task in `tasks/NEXT_ACTIONS.md` and `tasks/SPRINT_PLAN.md`. Add a line to `docs/CHANGELOG.md`. If you touched endpoints/schema, update `docs/API_SPEC.md` / `docs/DATA_MODEL.md` now, not later. Log any discovered-but-deferred work in `tasks/BACKLOG.md`, any new bug in `tasks/BUGS.md`.
7. **Report.** Tell the user: what was built, how you verified it (command + observed result), what's next in the queue.

## Definition of done
Code runs locally · acceptance criteria demonstrably met · tests pass · error paths handled · docs/changelog updated · task checked off.

## Anti-patterns (from CLAUDE.md — enforced)
- Building ahead of the task list "while I'm here"
- Abstract layers/helpers with one caller
- Swallowing exceptions or returning fake-success
- Marking done without running the app
- Fixing unrelated code you noticed (log it in BUGS.md/BACKLOG.md instead)

## Escalation
If the task turns out to require an architecture change or is fundamentally under-specified, stop and say so — that's Opus/planning work, not something to muscle through.
