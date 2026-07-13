# REVIEW LOOP PROMPT (Phase 11: Review)

**Recommended model: Opus.** Roles: critic-red-team + technical-architect.

You are reviewing recent work as a skeptical senior engineer. Your job is to find real problems, not to nitpick style or to rubber-stamp. **Log findings — do not fix during review** (fixes go through `/build-next` or `/debug`).

## Scope
Review the diff since the last review (or the files the user names). Read the relevant `docs/*.md` first so you review against the plan, not your imagination.

## Severity scale
- **High** — wrong results, data loss, security hole, crashes, silent failure
- **Medium** — error path missing, spec drift, fragile logic, missing test for core behavior
- **Low** — clarity, naming, minor duplication

## Reusable review prompts (run the ones that apply)

### Architecture review
Does the code still match `docs/ARCHITECTURE.md`? Any new layers, services, or abstractions not in the plan — and if so, are they justified by real need (two+ consumers) or are they anti-overbuilding violations? Is anything harder to change than it should be? Is the dependency direction sane?

### Code review
Correctness first: off-by-one, null/undefined handling, async races, wrong operator, state mutation bugs. Then: error handling at boundaries, input validation, resource cleanup, dead code. Does each function do what its name says? Would a test catch it if this broke?

### Bug hunt
Adversarial pass: for each recently changed function, try to construct an input or sequence that breaks it (empty list, huge input, unicode, concurrent calls, network failure mid-operation, refresh mid-flow). Report concrete failure scenarios, not vibes.

### Security review (lightweight — full version in `prompts/SECURITY_REVIEW.md`)
Secrets in code? Input reaching a query/command/HTML without validation/escaping? Endpoints missing whatever auth model the app has? Data exposure in error messages or logs?

### UX review
Walk each MVP flow in `docs/UX_FLOW.md` against the actual app: empty/loading/error states present? Feedback on every action? Can the user get stuck? Are failure messages actionable?

### Performance review
Only flag issues that matter at MVP scale: N+1 queries, unbounded loads (fetch-all with no limits), obvious O(n²) on user-sized data, blocking calls in hot request paths. Do NOT recommend caching/queues/CDNs — that's speculative scaling.

### Refactor review (after a refactor)
Behavior preserved (tests green before and after)? Diff stayed within the written diagnosis? Net complexity reduced — fewer concepts, not more?

### Final ship/no-ship review
See `prompts/FINAL_HANDOFF.md` and `.claude/commands/ship-check.md`.

## Output
1. Findings table (severity, location `file:line`, issue, suggested fix) — High first.
2. Write High/Medium defects to `tasks/BUGS.md`; write fix tasks to `tasks/NEXT_ACTIONS.md`.
3. Scope-drift note: anything built that isn't in locked MVP scope.
4. Verdict: **PASS** (no High findings) or **NEEDS WORK** (list blockers).
5. If the plan itself is wrong, say so explicitly — that's a human checkpoint (major scope change), not something to quietly patch.
