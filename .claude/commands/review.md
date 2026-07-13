---
description: "Phase 11: skeptical architecture + code review with quality gates; logs findings, doesn't fix"
argument-hint: (optional: files/area to focus on, or 'ux'/'perf'/'bughunt' for a targeted pass)
---

# /review — Review Loop

**Recommended model: Opus.** If not Opus, warn once ("review catches more on Opus — `/model opus`") but proceed if the user continues.

Focus (if given): $ARGUMENTS

Follow `prompts/REVIEW_LOOP.md`:

1. Determine scope: the diff since the last review (`git diff`/`git log`), or the given focus.
2. Read the relevant `docs/*.md` first — review against the plan.
3. Run the applicable review passes: architecture, code, bug hunt, lightweight security, UX, performance (MVP-scale only — no speculative-scaling recommendations).
4. Rate findings High/Medium/Low with `file:line` and a suggested fix. **Log, don't fix**: defects → `tasks/BUGS.md`, fix-tasks → `tasks/NEXT_ACTIONS.md`.
5. Flag scope drift: anything built that isn't in the locked MVP scope.
6. Verdict: PASS or NEEDS WORK (blockers listed). If the plan itself is wrong → human checkpoint, tell the user.

Style nitpicks are Low or omitted. Correctness, error handling, security, and spec drift are what matter.
