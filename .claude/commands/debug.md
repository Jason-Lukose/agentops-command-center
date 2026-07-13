---
description: "Phase 12: disciplined debugging — reproduce, isolate, hypothesize, smallest safe fix, regression test"
argument-hint: <description of the bug or bug ID from tasks/BUGS.md>
---

# /debug — Debug Loop

**Recommended model: Sonnet.** Escalate to Opus after 3 failed fix attempts (the loop enforces this).

Bug: $ARGUMENTS

Follow `prompts/DEBUG_LOOP.md` IN ORDER — no skipping to the fix:

1. **Reproduce** — trigger it yourself; write a failing test capturing it if possible. Can't reproduce → stop and ask for steps/logs.
2. **Isolate the layer** — UI / API / logic / store; find where good data goes bad.
3. **Inspect** — the failing code, its recent git history, logs, prior entries in `tasks/BUGS.md`.
4. **Hypothesize** — 1–3 written hypotheses, each with a testable prediction; test before fixing.
5. **Smallest safe fix** — minimum diff on the diagnosed path only. No rewrites, no cleanups, no dependency roulette. Structural problems → log in DECISIONS.md, propose `/refactor` separately. Destructive/migration fixes → ask the user first.
6. **Verify** — repro steps now clean, full test suite green, regression test kept.
7. **Record** — `tasks/BUGS.md` (root cause + fix), `docs/CHANGELOG.md`.

Track attempts in the bug's `Attempts:` field. At 3 failures: stop, write the dead-end summary (ruled-out layers, tested hypotheses), and tell the user to rerun `/debug` on Opus.
