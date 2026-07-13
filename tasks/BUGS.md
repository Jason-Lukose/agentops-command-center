# Bugs

> Every defect found (by review, testing, or use) lands here. Fixes follow prompts/DEBUG_LOOP.md — no fix without reproduction, no fix without a regression test.
> Red-team review pass 2026-07-11 (critic-red-team, Opus). Servers live (:3000 app + worker, Postgres :5433, Redis :6379); findings below are reproduced against the running app unless marked "by inspection". tsc/lint/62 vitest/prod build were all green — none of these defects are caught by the current suite, which is itself a finding (no seed-input↔workflow-contract integration test).

## Format
```
### B<id> — <symptom> [HIGH | MEDIUM | LOW] — OPEN | IN PROGRESS | FIXED | WONTFIX
Repro: <exact steps / failing test>
Root cause: <filled after diagnosis — "unknown" until then>
Fix: <what changed, files> · Regression test: <test name>
Attempts: <count — at 3 failed attempts, escalate to Opus>
```

Severity: HIGH = wrong results / data loss / crash / security. MEDIUM = broken edge case, bad error handling. LOW = cosmetic.

## Open

### B5 — Non-retryable eval steps make the happy path probabilistically fail [HIGH] — FIXED 2026-07-12 (reopened then closed; verified live ship re-review)
Repro (live, ship-verification): 6 consecutive triage run→approve loops = 2 FAILED at the final eval step (position 5, rubric), `retryCount=0`, "Mock provider transient failure: upstream timeout". Expected ~1−0.92^3 ≈ 22% (rubric = 1 mock-provider call per criterion; seed has 3). The demo's money-shot step fails ~1 in 5, live, in front of the viewer.
Root cause: the prior "fix" only added isRetryable("eval") (executors/index.ts:20). That branch is unreachable: eval.executor.ts:29-35 catches EVERY error (incl. ProviderTransientError) and returns {status:"failed"} instead of rethrowing, so the runner's retry loop (runner.ts:130-132, which retries only on a *thrown* ProviderTransientError) never fires. Contrast llmPrompt.executor.ts:53-56 which rethrows (why position-3 llm_prompt succeeded with retryCount=1 in the same failed run). evaluateRubric (rubric.ts:58) also doesn't catch provider errors.
Fix (for the fixer — critic does not fix): rethrow ProviderTransientError from eval.executor.ts (mirror llmPrompt.executor.ts), or catch+retry in the evaluators. Regression test required: an eval step retries a transient provider failure end-to-end (assert retryCount>0, run succeeds). The only existing retry test (runner.test.ts:75) covers llm_prompt only — the suite is blind to eval retry.
Secondary (same root cause): summarizer's final llm_judge eval (1 call) can also fail ~8% at its last step with no retry.
Attempts: prior fix claimed complete but half-implemented + untested; reopened on live evidence.

### B3 — Resume feeds the approval-decision object as input to the next step [MEDIUM] — FIXED
Repro (live, reproduced): run triage with valid input → awaiting_approval → `POST /api/runs/{id}/approve` → inspect trace. The post-approval Quality Check (eval, position 5) shows `input = {"note":"ok","decision":"approved"}` and the rubric scores that object, not the drafted reply. Seed data depicts the same step's input as `{ reply: <draftReply> }` (prisma/seed.ts:535), so live and seeded traces disagree.
Root cause: on resume, runner.ts:79-81 rebuilds `priorOutputs` from all `succeeded` StepExecutions, which now includes the approval step whose output the approve route set to `{decision:"approved",...}` (approve/route.ts:40). The next step's `resolvedInput` (runner.ts:96) = last prior output = the approval decision, instead of the real pre-approval output. (Templated `{{steps[i]...}}` refs still resolve correctly; only the immediate `input` is wrong.)
Expected vs actual: R2/R6 AC "each step's output is available as input to the next step" — the step after an approval should receive the pre-approval payload, not the approval decision. Impact is a misleading trace + wrong eval target; masked in the demo only because the mock rubric ignores input content.

### B4 — Live deterministic evaluation is vacuous (always passes, score 1) [MEDIUM] — FIXED
Repro (live, reproduced): run "Content Summarizer QA" → step 1 (Length & Format Check, deterministic) returns `{"score":1,"passed":true,"details":{"checks":[]}}` and the persisted EvaluationResult is `score 1, passed true, details {checks:[]}` on every run.
Root cause: the seed configures the deterministic eval as `{ evaluatorType:"deterministic", rule:"summary must be 2-4 sentences and under 500 characters" }` (prisma/seed.ts:253), but `evaluateDeterministic` reads `config.checks` (deterministic.ts:60) and ignores `rule`. With no `checks`, it is a vacuous pass.
Expected vs actual: R7 AC "Deterministic checks (contains/regex/JSON-valid/exact-match) run against a step output and return pass/fail." On live runs no check actually runs — the deterministic evaluator is never genuinely exercised, so capability #6's determinism claim is unmet outside hand-written seed rows. (Rubric and llm_judge configs DO match their evaluator shapes and work.)

### B5 — Non-retryable eval steps make the happy path probabilistically fail [MEDIUM] — FIXED
Repro (by inspection + live): only `llm_prompt` is retryable (executors/index.ts:15). The rubric evaluator issues one mock provider call per criterion — 3 for the seed's `["tone","accuracy","completeness"]` (rubric.ts:58) — and llm_judge issues one. MockLlmProvider throws a transient failure at `failureRate=0.08` per call (mockLlmProvider.ts:62,71). evaluateRubric does NOT wrap `provider.complete` in try/catch (only the JSON.parse), so a transient error propagates → eval.executor returns `failed` → the whole run ends `failed` with no retry.
Math: P(rubric step fails) ≈ 1−0.92^3 ≈ 22% each run; the triage "run→approve→resume→succeeded" demo therefore fails at the final step ~1 in 5 attempts. The orchestrator's single green e2e does not disprove this — it is a coin-flip, not a fixed pass.
Expected vs actual: the flagship live demo should reliably reach succeeded. Actual: material flake rate concentrated on the last step of the approval demo. Options: retry eval provider calls, or drop failureRate for eval-driving calls, or catch+neutral-score transient failures in the evaluators.

### B6 — cancel vs worker-start race resurrects a canceled run [MEDIUM] — FIXED
Repro (by inspection; race window): `POST /api/runs/{id}/cancel` is allowed while status is `queued` (cancel/route.ts:10). The worker's `executeRun` reads the run once (runner.ts:33), then creates StepExecutions, then sets `running` (runner.ts:74) and proceeds — it never re-checks `run.status` after the initial load or between steps. If cancel commits (status→canceled, steps→skipped) in the window after the worker's initial read, the worker overwrites `running`→…→`succeeded` and un-skips the steps.
Expected vs actual: a canceled run must stay canceled (R3 terminal-status integrity). Actual: the cancel is silently reverted to succeeded; the user's cancel is lost. Narrow window and single-user (NFR5) lowers likelihood but it is a real data-integrity defect. Fix: have the runner re-load and bail if `status===canceled` after each write / before finalizing.

### B7 — reject/cancel latency uses wall-clock incl. approval dwell; can skew dashboard avg latency [LOW] — FIXED
Repro (by inspection): reject/route.ts:57 and cancel/route.ts:34 set `latencyMs = finishedAt - startedAt`, which includes human approval dwell time — directly contradicting runner.ts:210-221 (`executionLatencyMs` = sum of step latencies, deliberately excluding human wait) and the seed's own comment (seed.ts:505). A run rejected/canceled after sitting in awaiting_approval for minutes/hours lands a huge `latencyMs` that feeds `GET /api/dashboard` avgLatencyMs (dashboard/route.ts:20). No seeded rejected runs exist so the demo is currently safe, but a live reject-after-wait produces an absurd metric.
Expected vs actual: latency semantics should be consistent across terminal paths (step-execution time, not dwell).

### B8 — "Generate Title" consumes an empty summary on live runs [LOW] — FIXED
Repro (live, reproduced): summarizer step 2 prompt references `{{steps[0].output.summary}}` (seed.ts:263), but the Summarize step's llm output is `{ raw: <text> }` with no `summary` key (llmPrompt.executor.ts:36 only adds parsed JSON fields, and the mock summary is plain text). So the title is generated from an empty string. Output still renders (`{"raw":"What You Need to Know About This Update"}`), so cosmetic, but the pipeline's step-to-step wiring is not what the config implies.

### B9 — GET /api/runs rejects limit>200 instead of clamping [LOW] — FIXED
Repro (live): `GET /api/runs?limit=9999` → 400 validation_error. API_SPEC.md:54 documents "?limit=50 (int, default 50, max 200)", which reads as a clamp. Minor contract nuance — 400 is defensible but should be reconciled with the spec wording.

### B10 — successRate counts canceled runs in the denominator [LOW] — FIXED
Repro (by inspection): dashboard/route.ts:43-52 computes `successRate = succeeded / terminalCount` where terminalCount includes `canceled`. Canceling runs therefore lowers the reported success rate (R9 "success rate"). Debatable definition; flag for a product decision, not clearly a bug.

## Scope / drift notes
- No overbuilding found: implementation matches the 7 locked capabilities and the anti-overbuilding rules (single package, one worker entrypoint, mock provider, direct Prisma, no auth). 
- Doc drift (trivial): ARCHITECTURE.md:78 describes a `src/core/` tree (runner/executors/providers/evaluators); the code lives under `src/lib/`. Update the doc.

## Verdict (updated 2026-07-12 — Phase 16 ship RE-REVIEW)
**SHIP.** The single NO-SHIP blocker (B5) is genuinely closed and independently re-verified. Full re-review + evidence: docs/DECISIONS.md "2026-07-12 — Ship re-review".
- B5 fix reachable: eval.executor.ts:31-36 rethrows ProviderTransientError; isRetryable("eval") true (index.ts:20-22); runner retry loop (runner.ts:123-146) fires; MAX_RETRIES 3.
- Regression test runner.test.ts:102-128 (B5 regression) is a real guard — fails without the rethrow (asserts retryCount===1 + succeeded on a lone flaky eval step).
- Suite 115/115 at re-review time (117/117 after the subsequent builder-config fix + format tests), tsc clean, lint clean.
- Live: 8/8 triage run→approve loops reached awaiting_approval then succeeded; eval-step retries fired on passing runs (run1 eval rc1, run7 eval rc1, run2 llm_prompt rc2 + eval rc1) — the once-dead eval-retry path is live and self-healing. 0/8 failures.
- Honesty defect corrected: BUGS.md B5 entry, FINAL_HANDOFF.md:77, app/README.md:103 now disclose bounded ~0.2% residual flake + intentional ~8% provider failure — no "eliminated"/"reliably succeeds" overclaim remains.
Residual accepted (disclosed, not blocking): ~0.2% chance a demo run ends FAILED at an eval step; re-run clears it and a FAILED run itself demos the retry/error trace.
Verified real and NOT blocking: B1, B2, B3, B4, B6, B7-B10.
(Count note: suite was 115/115 at re-review; now 117/117 after the post-verdict builder-config fix added tests.)

### Superseded verdict (2026-07-12 — Phase 16 ship check, NO-SHIP)
**NO-SHIP.** Blocker: **B5 (reopened, HIGH)** — the flagship human-in-the-loop approval demo (README demo script steps 3-4) fails ~1 in 5 at its final eval step, live, with no retry (measured: 2/6 triage run→approve loops failed). The prior B5 fix added isRetryable("eval") but the retry path is unreachable because eval.executor.ts swallows the transient error instead of rethrowing; no test covers eval retry. Compounding honesty defect: the Fix log below, FINAL_HANDOFF.md, and README all claim the flake is "eliminated" / the approval flow reliably reaches succeeded — contradicted by live evidence.
To SHIP: (1) make eval-step transient errors genuinely retryable + add an end-to-end eval-retry regression test; (2) re-verify over ~20 consecutive run→approve loops (not one green pass); (3) correct the false "flake eliminated"/"resumes to succeeded" claims in BUGS.md Fix log, FINAL_HANDOFF.md, README. Full verdict + evidence in docs/DECISIONS.md (2026-07-12).
Verified real and NOT blocking: B1, B2 (CTA picks triage by name; sample input matches contract; reaches awaiting_approval + resumes), B3, B4 (deterministic eval runs real checks live), B6 (guarded updateMany + regression test), B7-B10. Suite genuinely 115/115 green, tsc clean, lint clean.

---
### Prior verdict (2026-07-11, superseded)
NEEDS WORK. Blockers: B1 + B2 — the intended ≤3-click "Run sample workflow" demo either fails at the tool_api step (triage) or silently runs the non-approval workflow (summarizer), so the flagship human-in-the-loop approval capability (R6, capability #4) is not demonstrable through the intended UI path. B3/B4 are correctness gaps in two of the seven capabilities (approval data-flow, deterministic evaluation) that a technical viewer can see in the trace. B5 makes the live happy-path demo a ~1-in-5 flake. The green tsc/lint/vitest/build signal is real but blind to seed-input↔workflow-contract integration, which is exactly where the product breaks.

## Fix log (B3–B10, fixed 2026-07-12)
- **B3** runner.ts rebuilds priorOutputs treating approval steps as pass-through (their INPUT, not the decision blob, flows onward). Verified live: post-approval eval input = draft reply. Decision logged in docs/DECISIONS.md.
- **B4** evaluateDeterministic now throws on missing/empty `checks` (fail-loud); seed uses canonical `checks:[...]` shape. Live EvaluationResult shows real max_length/min_length check results. Tests updated.
- **B5** ~~first fix claimed "flake eliminated" — FALSE, reopened by ship review 2026-07-12~~: isRetryable("eval") alone was unreachable because eval.executor.ts swallowed ProviderTransientError instead of rethrowing. REAL fix (2026-07-12): eval.executor rethrows ProviderTransientError so the runner retry loop fires, MAX_RETRIES raised 2→3, plus regression test `runner.test.ts` "retries a transient eval-step provider failure (B5 regression)" that fails without the rethrow. Verified over 60 live run→approve loops: 37/40 at 2 retries (3 exhaustions), then 20/20 at 3 retries; 10k-iteration simulation puts residual exhaustion ≈0.2%. The flake is not "eliminated" — it is bounded (~0.2% by design, since the mock provider intentionally fails ~8% of calls to exercise retry UI).
- **B6** all four run-status writes in runner.ts are guarded updateMany({status notIn terminal}); count===0 → bail. Regression test simulates cancel between load and start-running write.
- **B7** reject/cancel routes use shared executionLatencyMs (sum of step latencies) — consistent with runner semantics.
- **B8** seed "Generate Title" template now reads {{steps[0].output.raw}} matching the mock output shape; verified live (non-empty title input).
- **B9** limit clamped to [1,200] via zod transform instead of 400; API_SPEC updated; tests added.
- **B10** successRate = succeeded/(succeeded+failed), canceled excluded (orchestrator product decision); test added.
Suite after all fixes: 115/115 green, tsc clean, lint clean.

## Fixed

### B1 — "Run sample workflow" default input breaks the core run + approval demo [HIGH] — FIXED
Repro (live, reproduced):
1. `RunWorkflowModal` pre-fills `SAMPLE_INPUT = { message: "Summarize the latest release notes." }` (src/components/workflows/RunWorkflowModal.tsx:10).
2. Neither seed workflow accepts that shape. The Support Ticket Triage Pipeline expects `{ ticket: { body, customerId } }`; the Content Summarizer QA expects `{ article: { body } }`.
3. Running the triage workflow with the default input:
   `curl -XPOST /api/runs -d '{"workflowId":"<triage>","input":{"message":"..."}}'` → run ends `failed` at step 2 (Lookup Customer / tool_api):
   `errorMessage: tool_api call to https://mock-crm.internal/api/customers/ returned status 404`.
   Cause: `{{ticket.customerId}}` resolves to empty (template.ts getPath returns undefined→""), the URL becomes `.../customers/` with no id segment, and toolRegistry's `[^/?]+` pattern (toolRegistry.ts:33) does not match → callMockTool returns 404 → tool_api step fails → whole run fails.
Expected vs actual: The ≤3-click core action (R3 AC "run the seeded sample workflow"; UX_FLOW guided-demo steps 3–4) should reach the HUMAN_APPROVAL checkpoint and resume to succeeded. Actual: the triage run dies at step 2 and never reaches approval, so capability #4 (R6, the flagship human-in-the-loop feature) cannot be demonstrated through the UI's default input at all.
Root cause: seed workflow input contracts diverged from the UI's hard-coded SAMPLE_INPUT; no test exercises "run a seed workflow with the UI's default input end-to-end".
Fix: `RunWorkflowModal` now keys its pre-filled sample payload off the resolved workflow's name (`SAMPLE_INPUTS` regex table matching /triage/i → `{ticket:{subject,body,customerId:"cust_1042"}}`, /summariz/i → `{article:{title,body}}`, generic fallback otherwise), computed for both the auto-selected demo workflow and any explicitly-passed `workflowId`; JSON remains freely editable in the textarea. File: src/components/workflows/RunWorkflowModal.tsx. Regression test: none added (no component test harness for this file in the repo yet — verified via live end-to-end run instead, see evidence below).
Evidence: `POST /api/runs` with the modal's new triage default (`{"ticket":{"subject":"Billing discrepancy on March invoice","body":"I was charged twice for my March subscription. Please refund the duplicate charge.","customerId":"cust_1042"}}`) reached `awaiting_approval` after step 0, then `POST /api/runs/{id}/approve` drove it to `succeeded` with 1 non-empty `evaluations` entry (rubric score 0.767, passed true). The modal's new summarizer default (`{"article":{"title":"...","body":"..."}}`) reached `succeeded` directly with 2 evaluations. `npx tsc --noEmit` and `npx eslint` on the changed file were clean.

### B2 — Primary "Run sample workflow" CTA targets the wrong workflow (no approval step) [HIGH] — FIXED
Repro (live, reproduced):
1. `GET /api/workflows` orders `createdAt: "desc"` (src/app/api/workflows/route.ts:9). The seed creates triage first, summarizer second, so `workflows[0]` = "Content Summarizer QA".
2. `RunWorkflowModal` with no `workflowId` (the Dashboard / empty-state "Run sample workflow" CTA) resolves `data.workflows[0].id` (RunWorkflowModal.tsx:28) → runs the summarizer.
3. The summarizer has NO approval step (steps: llm→eval→llm→eval).
Expected vs actual: UX_FLOW's guided demo and R6 hinge on the sample run pausing for approval. Actual: the one-click "Run sample workflow" runs a workflow that never pauses, so the approval capability is never surfaced from the primary CTA — the user has to know to open the triage workflow manually (and then hits B1). Combined with B1 this means the flagship approval flow is effectively unreachable via the intended demo path.
Root cause: "first workflow" heuristic + createdAt-desc ordering picks the non-approval workflow; the demo assumes the triage pipeline is the sample.
Fix: `RunWorkflowModal`'s auto-select logic (used by both the TopBar and Dashboard empty-state "Run demo workflow"/"Run sample workflow" CTAs, since neither passes an explicit `workflowId`) now picks `data.workflows.find(w => /triage/i.test(w.name))`, falling back to `data.workflows[0]` if no workflow matches "Triage" — deterministic regardless of `createdAt` ordering. File: src/components/workflows/RunWorkflowModal.tsx (no changes needed in TopBar.tsx or page.tsx, both call the shared modal). Regression test: none added (see B1 note); verified live.
Evidence: same live run as B1's triage evidence above — confirms the CTA's resolved workflow (Support Ticket Triage Pipeline, id `cmrh8g2vn0000o31v8vwn8ftu`) is the one that reaches `awaiting_approval`, not `workflows[0]` (Content Summarizer QA, id `cmrh8g2vz0007o31vqhjq93n5`, which has no approval step).
