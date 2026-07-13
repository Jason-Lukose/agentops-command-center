---
description: "Phase 14: sync all docs with reality — changelog, specs, decisions, task hygiene"
argument-hint: (no arguments)
---

# /update-docs — Documentation Sync

**Recommended model: Sonnet** (Haiku fine for changelog/formatting-only passes).

Make the docs match the code — never the other way around, and never aspirational:

1. **Diff scan**: what changed since docs were last touched (`git log`, recent CHANGELOG entries)?
2. **Spec sync**: `docs/API_SPEC.md` vs actual endpoints; `docs/DATA_MODEL.md` vs actual schema; `docs/ARCHITECTURE.md` vs actual layout and run commands (verify the run commands actually work).
3. **Changelog**: fill any missing entries in `docs/CHANGELOG.md`; normalize format.
4. **Decisions**: any non-obvious choice made recently but not logged → add to `docs/DECISIONS.md` (ask the user if you can't reconstruct the rationale).
5. **Task hygiene**: `tasks/NEXT_ACTIONS.md` and `tasks/SPRINT_PLAN.md` reflect reality — no stale "in progress"; done work checked off; `tasks/BUGS.md` statuses current.
6. **App README**: setup/run instructions current (fresh-eyes read).
7. Report: what was out of sync (that list is a health signal — chronic drift means the build loop is skipping step 6).

Do not invent content for unbuilt features. Template sections stay templates until their phase runs.
