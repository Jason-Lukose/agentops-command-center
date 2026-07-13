---
description: "Phase 13: diagnosed, scoped, behavior-preserving refactor with tests as safety net"
argument-hint: <what hurts and where — e.g. "adding a field requires edits in 5 files">
---

# /refactor — Refactor Loop

**Recommended model: Sonnet** for routine refactors; **Opus** for structural ones (module boundaries, project-wide patterns). Judge which this is at step 1 and say so.

Target/pain: $ARGUMENTS

Follow `prompts/REFACTOR_LOOP.md`:

1. **Diagnosis into `docs/DECISIONS.md` first**: observed pain (not aesthetics), scope (files it may touch), non-goals, expected win. No diagnosis, no refactor. Touching >~30% of the codebase → human checkpoint, get approval.
2. **Safety net**: affected behavior covered by green tests; if not, write characterization tests first.
3. **Small steps**: one transformation at a time, tests between steps, never mixed with behavior changes. Bugs found mid-refactor → BUGS.md, not fixed inline.
4. **Scope police**: diff stays inside the declared scope; drift gets reverted and logged in BACKLOG.md.
5. **Verify the win**: tests green, behavior identical, the declared pain actually reduced — report honestly if not.
6. **Record**: CHANGELOG.md line, DECISIONS.md closed out, ARCHITECTURE.md updated if layout changed.

Refuse to refactor: before the MVP works end-to-end, for single-consumer abstractions, or "because newer library exists."
