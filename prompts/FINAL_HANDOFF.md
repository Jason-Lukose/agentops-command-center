# FINAL HANDOFF PROMPT (Phases 15–16: Deployment Readiness + Handoff)

**Recommended model: Opus** for the ship/no-ship verdict; **Sonnet** for assembling docs.

The end state: the user owns a project they can run, deploy, and extend **without this conversation's context**. Honesty over polish — a handoff that hides broken things is a failed handoff.

## 1. Deployment readiness (devops-engineer)
- Fresh-clone test: from a clean checkout, follow `docs/DEPLOYMENT.md` / README setup steps literally. Fix the docs where they fail.
- `.env.example` complete; secrets handling verified.
- Deploy steps written AND a rollback path written ("how do I undo a bad deploy").
- Costs stated: confirm everything is on free tier, or list exactly what costs money (human checkpoint if anything does).
- **Actual deployment is a human checkpoint — prepare everything, then ask.**

## 2. Security sign-off (security-reviewer)
Run `prompts/SECURITY_REVIEW.md` if not already done this cycle. Any High finding blocks shipping.

## 3. Ship/No-Ship review (critic-red-team, Opus)
Answer each with evidence, not optimism:
- [ ] Do all locked MVP capabilities work end-to-end, verified by actually running them?
- [ ] Are all High-severity bugs in `tasks/BUGS.md` fixed or explicitly accepted by the user?
- [ ] Do the tests pass, and do they cover the acceptance criteria?
- [ ] Security review: CLEAR?
- [ ] Can a new person run it from the docs alone (fresh-clone test done)?
- [ ] Is there anything the user would be unpleasantly surprised by after shipping?

Verdict in `docs/DECISIONS.md`: **SHIP** or **NO-SHIP + blocker list**. A NO-SHIP with clear blockers is a good outcome; ship theater is not.

## 4. Write `docs/HANDOFF.md` (documentation-writer)
Fill the template completely:
- What was built (capabilities, mapped to requirement IDs) — and what was NOT built (deferred list)
- How to run locally / deploy / roll back (or link to DEPLOYMENT.md)
- Known issues and limitations — plain language, nothing buried
- Where everything lives (file map of the app)
- Open bugs (from BUGS.md) and top risks (from RISKS.md)
- Recommended next 3 steps post-MVP
- How to resume work with this kit ("open Claude Code here, run `/build-next`")

## 5. Final sweep
- `docs/CHANGELOG.md` current; `tasks/*` reflect reality (no stale "in progress")
- `docs/` contradictions resolved
- Tell the user: verdict, one-paragraph summary, and where HANDOFF.md is.
