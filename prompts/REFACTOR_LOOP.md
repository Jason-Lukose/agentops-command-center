# REFACTOR LOOP PROMPT (Phase 13: Refactor)

**Recommended model: Sonnet** for routine refactors; **Opus** for structural ones (moving module boundaries, changing patterns project-wide).

A refactor changes structure, never behavior. It is earned by pain, not by taste.

## 1. Diagnosis first (mandatory)
Before touching code, write into `docs/DECISIONS.md`:
- **Pain:** the concrete, observed problem (e.g., "adding a new deadline type required edits in 5 files"; "3 of the last 4 bugs were in this function"). "The code is ugly" is not pain.
- **Scope:** exactly which files/modules this refactor may touch.
- **Non-goals:** what it will NOT change.
- **Expected win:** what gets easier, stated so we can check afterwards.

If the refactor would touch more than ~30% of the codebase, this is a major change → **human checkpoint, get approval first.**

## 2. Safety net
Confirm the affected behavior is covered by passing tests. If not, **write characterization tests first** (capture current behavior, even if imperfect), then refactor. No net, no refactor.

## 3. Execute in small steps
Refactor in the smallest increments that keep tests green — rename, extract, inline, move, one at a time, running tests between steps. Never mix a refactor commit with a behavior change. If you discover a bug mid-refactor, log it in `tasks/BUGS.md` and finish the refactor without fixing it (or abort, fix via `/debug`, restart).

## 4. Scope police
At each step, check the diff against the declared scope. Drifting? Stop, revert the drift, log the temptation in `tasks/BACKLOG.md`. The classic failure: a refactor that becomes a rewrite. Rewrites of large portions of the codebase without a diagnosis are forbidden (CLAUDE.md rule 9).

## 5. Verify the win
Tests green. Behavior identical (spot-check the app manually). Then check the "expected win": is the thing that was hard now easy? If not, say so honestly — an ineffective refactor is a finding, not a failure to hide.

## 6. Record
`docs/CHANGELOG.md` one line; close the loop in `docs/DECISIONS.md` ("done, win confirmed/not confirmed"); update `docs/ARCHITECTURE.md` if module layout changed.

## When NOT to refactor
- Before the MVP works end-to-end
- To introduce a pattern/abstraction with a single consumer
- Because a newer library/framework exists
- During a bug fix or feature task (log it instead)
