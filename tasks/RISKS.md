# Risks

> Top project risks, updated at planning (Phase 8) and whenever a new one appears. Keep it to the ones that matter; this is a solo MVP, not an enterprise risk register.

## Format
```
### K<id> — <risk> [likelihood: L/M/H × impact: L/M/H]
Mitigation: <what we're doing about it, or "accepted">
Trigger: <early warning sign that it's happening>
```

## Active Risks

### K1 — Pause/resume-via-requeue correctness [likelihood: M × impact: H]
The core "wow" flow (approval halts a run, requeue resumes it) is the trickiest logic. If resume re-runs already-succeeded steps, double-executes on duplicate job delivery, or picks the wrong step, traces corrupt and the demo breaks.
Mitigation: prove the pause half in Sprint 1 (T6) and the resume half in Sprint 2 (T11/T12); resume derives its cursor from the first non-terminal `StepExecution` (not in-memory state); make the runner idempotent per step; T25 tests pause-on-approval and resume explicitly.
Trigger: a resumed run shows duplicate StepExecutions, re-runs a succeeded step, or lands in a non-terminal limbo state.

### K2 — Mock-provider realism (the demo depends on it) [likelihood: M × impact: H]
The entire value story ($0, no keys) rides on mock outputs looking authentic. Flat, identical, always-succeeding responses make traces/retries/eval scores look fake and undercut the resume artifact.
Mitigation: T4 mandates varied outputs, variable latency, and occasional simulated failures; T5 tool executor emits simulated errors; seed data (T1) includes at least one failed run and one approved run so first-open traces already look real.
Trigger: every step in a trace has near-identical output/latency, zero failures ever occur, or eval scores are constant.

### K3 — Docker not yet available on this machine [likelihood: H × impact: M]
Docker Desktop is still installing, so Postgres + Redis aren't reachable. Migration, seed, and the T2 walking-skeleton live proof cannot run until it's up.
Mitigation: write T2/T3/T4 code against the agreed schema now; keep the enqueue→worker→DB round-trip behind a single `docker compose up -d` + `prisma migrate dev`; T1 (schema/seed) and T2 (skeleton) both carry an explicit "needs Docker up" note so no one marks them done on unverified code.
Trigger: any Sprint-1 task checked off without the app having actually run end-to-end against live Postgres/Redis.

### K4 — Frontend polish scope creep [likelihood: H × impact: M]
Sprint 3 is where "just one more animation / another metric / a settings toggle" quietly inflates scope past the locked 7 capabilities, blowing the timeline before tests and docs (Sprint 4) get done.
Mitigation: frontend tasks (T15–T24) are scoped to the screens in docs/UX_FLOW.md only; motion is one dedicated task (T24), not sprinkled ad hoc; anything beyond the locked scope goes to BACKLOG "Post-MVP", not into the sprint (promoting it is a major-scope-change human checkpoint).
Trigger: a new screen/animation/setting appears that no MVP user story in UX_FLOW.md requires.

### K5 — Solo bus-factor / lost context across sessions [likelihood: M × impact: M]
Multiple models/sessions build this; a cold start with stale queue state re-does or skips work.
Mitigation: NEXT_ACTIONS "In Progress" carries precise resume notes; the queue is kept truthful (no done-but-unchecked items); docs are the source of truth; FINAL_HANDOFF (T30) closes it out.
Trigger: a session finds the queue disagrees with the code (a task marked in-progress that's actually done, or vice versa).

## Retired Risks
<!-- Risk + why it no longer applies. -->
