# Decisions Log

> Append-only. Every non-obvious choice gets a line: models switch, sessions end, but this file remembers WHY.
> Also holds refactor diagnoses (see prompts/REFACTOR_LOOP.md) and ship/no-ship verdicts.

## Format
```
## YYYY-MM-DD — <decision title>
Decision: <what was chosen>
Why: <1-3 sentences, including what was rejected>
Revisit when: <trigger, e.g. "more than 10 users", "adding feature X">
```

## Decisions

<!-- Newest first. -->

## Architecture decisions — 2026-07-11

## 2026-07-11 — Worker runs in the same package, not a microservice
Decision: Background run execution is a second entrypoint (`npm run worker`, a tsx script) inside the same Next.js package, consuming a BullMQ queue.
Why: Keeps one deployable unit and one dependency set; the worker shares the Prisma client, queue config, and core code with the app. A separate service would duplicate deploy/config for no MVP benefit (anti-overbuilding rule 1).
Revisit when: worker load needs to scale or deploy independently of the web app.

## 2026-07-11 — UI polling, not WebSockets
Decision: The UI reads run/trace status by polling `GET /api/runs/{id}` on a ~2s SWR interval until a terminal status; no realtime transport in MVP.
Why: Single local user watching one run at a time — polling is trivial, needs no socket server, and works through Next route handlers. WebSockets add a persistent connection layer and worker→client push plumbing we don't need yet.
Revisit when: sub-second live updates or many concurrent viewers are required.

## 2026-07-11 — Mock provider is the default (zero API keys)
Decision: Step execution and the LLM-judge evaluator sit behind a small Provider interface; `MockLLMProvider` (deterministic-ish canned output + simulated latency) is the default via `PROVIDER_MODE=mock`.
Why: Keeps the MVP $0 and runnable with no external API or key (a human checkpoint), and makes tests hermetic. The interface leaves a clean seam to add a real provider later.
Revisit when: a real LLM provider is approved (external API + key = human checkpoint).

## 2026-07-11 — Approval folded into StepExecution (no ApprovalRequest table)
Decision: An `approval` step is a `StepExecution` with status `awaiting_approval`; approve/reject flips its status, sets `approvalDecidedAt`, and (on approve) re-enqueues the run. No separate ApprovalRequest entity.
Why: There is exactly one pending approval per paused run and it is strictly 1:1 with the step execution; a separate table would duplicate run/step/position/status/timestamp columns and require sync. Rejected because it adds a table without adding data the MVP needs.
Revisit when: approvals gain their own fields (assignee, SLA, multi-approver).

## 2026-07-11 — Ordered-list workflow builder, not a drag-and-drop canvas
Decision: Workflows are an ordered list of steps (`position` int, unique per workflow); the builder edits a list, not a node graph.
Why: MVP workflows execute strictly sequentially, so a list captures the full model; a canvas implies branching/parallelism that isn't in scope and is far more UI to build and test.
Revisit when: branching, parallel, or conditional steps enter scope.

## 2026-07-11 — Call Prisma directly; no repository/service layer
Decision: Route handlers and the runner use the Prisma client directly (one `db.ts` singleton); no repository or service abstraction.
Why: There is a single data backend and one implementation — an abstraction layer would have one consumer and hide nothing (anti-overbuilding rule 6). Add it only when a second backend or real duplication appears.
Revisit when: a second persistence target or repeated identical query logic emerges.

## 2026-07-11 — Approval pause via job completion, not a blocked worker
Decision: On an approval step the runner sets `awaiting_approval` and lets the BullMQ job complete; the approve endpoint re-enqueues a fresh job that resumes from the first non-terminal step.
Why: Blocking a worker on human input would tie up a concurrency slot indefinitely and risk job timeouts. Completing and re-enqueueing keeps the worker free and makes resume a normal queue operation.
Revisit when: runs need to preserve in-memory state across the pause (they don't — state is in the DB).

## 2026-07-11 — Postgres + Prisma over a lighter store
Decision: PostgreSQL 16 via Prisma for all persistence (user-dictated stack).
Why: Runs are relational (Workflow→Step→Run→StepExecution→EvaluationResult) and the dashboard needs indexed aggregates over runs/executions; Prisma gives typed queries + migrations. Json columns absorb per-step config and free-form I/O without extra tables.
Revisit when: never for MVP — matches dictated stack.

## 2026-07-11 — Design/animation skill authority
Decision: Use the installed `ui-ux-pro-max` skill (~/.claude/skills/ui-ux-pro-max) as the design AND animation authority. A dedicated "Framer Motion animation skill" was NOT found in this environment (searched ~/.claude/skills and project .claude/); the closest match is ui-ux-pro-max's Animation ruleset + motion.csv (GSAP-oriented, principles adapted to Framer Motion).
Why: The user named two uploaded skills; only one exists here. Proceeding per user instruction to use strong defaults and note the gap in FINAL_HANDOFF.md.
Implementation-relevant rules adopted from ui-ux-pro-max:
- Micro-interactions 150–300ms; complex transitions ≤400ms; never >500ms. Exit ≈60–70% of enter duration.
- ease-out on enter, ease-in on exit; prefer spring/physics for natural feel; consistent global duration/easing tokens.
- Animate transform/opacity only (no width/height/top/left); no layout-shift-causing animation (CLS).
- Stagger list/grid entrances 30–50ms/item; crossfade for content replacement; modals animate from trigger (scale+fade).
- Every animation expresses cause–effect, max 1–2 animated elements per view; animations interruptible, never input-blocking.
- Respect prefers-reduced-motion everywhere (disable/reduce).
- Skeletons (not spinners) for >300ms loads; contrast 4.5:1; visible focus rings; semantic color tokens; 4/8px spacing scale; tabular numerals for data columns; SVG icons (lucide), never emoji icons.
Revisit when: A real Framer Motion skill is added to the environment.

## 2026-07-11 — MVP scope pre-approved by user
Decision: Treat the detailed /start-project spec (2026-07-11) as the user-approved MVP scope lock; do not pause the loop at the Phase 4 checkpoint.
Why: The user enumerated the full requirement list, acceptance criteria, and explicit "do not stop after planning / pause only for destructive, paid, deploy, or user-only input" instructions. Re-asking would violate those instructions.
Revisit when: Any change to the enumerated scope (that IS a checkpoint).

## 2026-07-11 — App lives in `app/` subdirectory; infra via Docker Compose
Decision: Scaffolded Next.js (TS, Tailwind, App Router, src dir) into `app/` alongside the kit's docs/ and tasks/. Local infra: Docker Compose (postgres:16 + redis:7). Docker was not initially installed on this Mac; the user chose to install Docker Desktop rather than use Homebrew services.
Why: create-next-app requires an empty dir; keeping the orchestration kit at repo root preserves the loop docs. Compose matches the user-specified stack and is reproducible on any machine.
Revisit when: n/a.

## 2026-07-11 — Postgres container on host port 5433
Decision: docker-compose maps Postgres to host 5433 (container 5432 unchanged); DATABASE_URL updated accordingly.
Why: This Mac already runs a native Postgres bound to 127.0.0.1:5432 (loopback bind shadows Docker's 0.0.0.0 bind for localhost connections), which caused P1010/role errors. Moving the container port avoids touching the user's existing database service.
Revisit when: never — 5433 is documented in .env.example and README.

## 2026-07-11 — Run latency = execution time (sum of step latencies)
Decision: Run.latencyMs is the SUM of its StepExecutions' latencyMs everywhere (runner success/failure paths AND reject/cancel routes via the shared exported executionLatencyMs helper), not wall-clock finishedAt−startedAt.
Why: Wall-clock counted human-approval dwell (seeded dashboard showed a 45-minute "avg latency"). Execution time is the observability-meaningful number; reject/cancel were fixed too so avg(latencyMs) compares like with like (architect review finding).
Revisit when: dwell-time analytics become a feature (store both).

## 2026-07-11 — Approval steps are pass-through in the data pipeline
Decision: When the runner rebuilds prior outputs on resume, an approval step contributes its INPUT (the payload under review), not its {decision, note} output blob.
Why: Live evidence showed the post-approval eval step scoring {"decision":"approved"} instead of the drafted reply. Approvals are gates, not transformers.
Revisit when: a workflow legitimately needs the decision metadata downstream (use {{steps[i].output}} templates).

## 2026-07-11 — Transient provider errors retryable on eval steps too
Decision: isRetryable includes eval (rubric/llm_judge call the provider), not just llm_prompt.
Why: The mock provider's intentional ~8% transient failure made ~8% of demo runs die at their final eval step with retryCount 0 (found via live probe).
Revisit when: per-step retry policy becomes configurable.

## 2026-07-12 — SHIP/NO-SHIP verdict

Verdict: **NO-SHIP** (critic-red-team, Opus, Phase 16). One HIGH blocker plus a handoff-honesty defect. Scope judged: local recruiter-demo project (public deployment explicitly out of scope / human checkpoint).

What was verified GREEN and is real:
- Suite: `npx vitest run` = 114/114 passing (19 files); `npx tsc --noEmit` clean; `npm run lint` clean. All honest.
- B1/B2 fixes are REAL: `RunWorkflowModal` now selects the triage workflow by name (`/triage/i`), not `workflows[0]` (which is "Content Summarizer QA" under createdAt-desc), and pre-fills the triage-contract sample input. Live: triage run reached `awaiting_approval` after step 4 and, on approval, resumed through the remaining steps.
- B4 fix is REAL: live deterministic eval now runs actual checks — `details.checks = [{max_length, length 231 <= 500, passed}, {min_length, length 231 >= 10, passed}]`, score 1. No longer vacuous.
- B6 fix is REAL: all four run-status writes in runner.ts are guarded `updateMany({ status: { notIn: terminal }})` with count===0 bail; dedicated regression test `runner.test.ts:103 "cancel/worker-start race (B6)"` asserts a run canceled between load and start-running stays canceled.
- B3 fix present by inspection: runner.ts:89-94 treats approval steps as pass-through (contributes INPUT, not the decision blob).
- Honesty audit of README/FINAL_HANDOFF mostly holds: quickstart commands match package.json + prisma.config.ts (seed via `tsx prisma/seed.ts`, port 5433); Limitations admits mock-only provider, no auth, no deployment, uncaptured screenshots, dark-mode-only; Framer-Motion-skill-not-found note present. Resume-bullet numbers recount TRUE: 114 tests, 5 Prisma models (workflows, workflow_steps, runs, step_executions, evaluation_results), 3 evaluators, 5 step types, ~8% (0.08) failure rate, B6 race test exists.

BLOCKER (NO-SHIP):
- **B5 is NOT fixed — reopened as HIGH.** The flagship human-in-the-loop approval demo — the exact path README's demo script step 3-4 tells a recruiter to click — fails ~1 in 4-5 runs at its FINAL eval step, live, with no retry. Live evidence: 6 consecutive triage run→approve attempts = 2 failures (runs failed at position-5 rubric eval, `retryCount=0`, "Mock provider transient failure: upstream timeout"). Expected rate ≈ 1−0.92^3 ≈ 22% (rubric issues one mock-provider call per criterion; seed has 3 criteria).
  Root cause: the B5 "fix" only added `isRetryable("eval")` (executors/index.ts:20-22) but the retry loop is unreachable for eval. `eval.executor.ts:29-35` wraps `runEvaluator` in try/catch and converts EVERY error — including `ProviderTransientError` — into a `{status:"failed"}` result instead of rethrowing. The runner (runner.ts:130-132) only retries on a *thrown* `ProviderTransientError`. Contrast `llmPrompt.executor.ts:53-56`, which explicitly rethrows it ("Re-throw so the runner's retry loop can distinguish transient failures") — which is why position-3 llm_prompt succeeded with retryCount=1 in the same failed run. `evaluateRubric` (rubric.ts:58) also does not catch provider errors.
  No test covers this: the only retry test (runner.test.ts:75) exercises llm_prompt; nothing asserts an eval step retries a transient provider error. The suite is blind here exactly as the original B5 finding warned.
  Secondary same-root-cause flake: the summarizer's final `llm_judge` eval (1 provider call) can also fail ~8% at its last step with no retry.

HONESTY DEFECT (contributes to NO-SHIP):
- BUGS.md Fix log claims "B5 ... transient provider errors retried up to 2x. Happy-path flake eliminated." FINAL_HANDOFF.md:50-52 presents the live approval lifecycle as a clean reach-succeeded, and README demo step 4 says "Click Approve and watch it resume to succeeded." All are contradicted by live evidence: the money-shot demo is a ~1-in-5 coin flip that shows a red FAILED run in front of the viewer. A handoff that claims the flake is eliminated is not honest.

What blocks SHIP (must fix, then re-verify with a multi-run live loop, not a single green pass):
1. Make eval-step transient provider errors actually retryable: rethrow `ProviderTransientError` from `eval.executor.ts` (mirror `llmPrompt.executor.ts:53-56`), OR catch+retry inside the evaluators. Add a regression test that an eval step retries a transient provider failure end-to-end (assert retryCount>0 and run succeeds).
2. Correct the false claims in BUGS.md Fix log, FINAL_HANDOFF.md, and README demo script once (1) is proven over ~20 consecutive run→approve loops.

Not blockers (fixes verified real): B1, B2, B3, B4, B6, B7-B10 per fix log.

## 2026-07-12 — Ship re-review

Verdict: **SHIP** (critic-red-team, Opus, Phase 16 re-review). Supersedes the NO-SHIP above for the single blocker it raised; the original NO-SHIP entry is preserved unedited. Scope unchanged: local recruiter-demo project (public deployment out of scope / human checkpoint). Every claim below independently re-verified against source + the running app — not taken on the orchestrator's word.

The B5 blocker is genuinely closed:
- **Code path now reachable.** `eval.executor.ts:31-36` rethrows `ProviderTransientError` instead of swallowing it (mirrors `llmPrompt.executor.ts:54-57`). `isRetryable("eval")` returns true (`executors/index.ts:20-22`), and the runner's retry loop (`runner.ts:123-146`) retries on a thrown `ProviderTransientError` for any retryable step type. `MAX_RETRIES` is 3 (`runner.ts:11`), giving 4 total attempts. This is exactly the fix the NO-SHIP demanded — the previously-dead retry branch is now live.
- **Regression test is a real guard.** `runner.test.ts:102-128` ("retries a transient eval-step provider failure ... (B5 regression)") runs a lone eval step against a judge that throws once, then asserts `status==="succeeded"`, `retryCount===1`, `calls===2`. Without the eval.executor rethrow this fails (the step would terminate `failed` at retryCount 0). Confirmed by reading the assertions, not just the pass count.
- **Suite/compiler/lint green.** `npx vitest run` = 115/115 (19 files); `npx tsc --noEmit` clean; `npm run lint` clean. The +1 vs the prior 114 is the B5 regression test.
- **Live re-verification (independent).** 8 consecutive triage run→approve loops (CTA workflow "Support Ticket Triage Pipeline", input `{ticket:{subject,body,customerId:"cust_1042"}}`): 8/8 reached `awaiting_approval`, then 8/8 reached `succeeded` after POST .../approve. Retries fired ON PASSING RUNS — the strongest possible evidence the eval-retry path works: run 1 eval step (position 5) rc1, run 7 eval rc1, run 2 both an llm_prompt rc2 (position 3) AND eval rc1 (position 5) — all still succeeded. The money-shot final eval step demonstrably absorbs transient failures instead of dying on them. 0/8 failures observed; residual ≈0.2% (bounded, by-design ~8% provider failure) is consistent with the orchestrator's 10k-sim and 60-loop numbers.
- **Honesty defect corrected.** BUGS.md B5 Fix-log entry now records the false "eliminated" claim, the reopen, the real fix, and frames the flake as bounded (~0.2%), not eliminated. FINAL_HANDOFF.md:77 and app/README.md:103 both now disclose the intentional ~8% provider failure rate and the residual ≈0.2% demo-failure chance, and note that a failed run itself demos the retry/error trace. No remaining "eliminated"/"reliably succeeds" overclaim found.

Residual risk accepted (not blocking): a demo run still has a ~0.2% chance of ending FAILED at an eval step; this is now disclosed truthfully and a re-run clears it, and a FAILED run is itself a legitimate demo of the retry/error trace. Independently confirmed still-real, still-not-blocking: B1-B4, B6-B10 per prior verdict.

Minor non-blocking staleness (for /update-docs, not a ship gate): tasks/BUGS.md Verdict line and Fix-log line still say "114/114"; the actual suite is 115/115 after the B5 regression test. Cosmetic; does not affect any honesty-critical claim.

## 2026-07-12 — Real provider seam: OpenAI-compat over per-vendor SDKs

Why: user explicitly approved adding a real LLM provider behind `PROVIDER_MODE`, free-tier only, no key required to build/test (human checkpoint cleared). Rather than adding a per-vendor SDK dependency (`@google/genai`, `groq-sdk`, etc.), `src/lib/providers/openaiCompatProvider.ts` implements the `Provider` interface with a single plain-`fetch` client against the OpenAI chat-completions wire format (`POST {baseUrl}/chat/completions`). Google Gemini (`https://generativelanguage.googleapis.com/v1beta/openai`), Groq (`https://api.groq.com/openai/v1`), and OpenRouter's free models all speak this exact format, so one implementation with zero SDK deps covers all three free tiers — swapping vendor is just changing `LLM_BASE_URL`/`LLM_MODEL` in `.env`, no code change. `getProvider()` (`src/lib/providers/index.ts`) gained a `PROVIDER_MODE="live"` branch that constructs it from `LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL`, with a config error that lists exactly which env var(s) are missing (never leaks a partial/invalid key in error text). `PROVIDER_MODE` still defaults to `"mock"` — flipping to `"live"` remains a deliberate, explicit opt-in per the original human-checkpoint rule. Errors map to the runner's existing retry seam: network failures, timeouts (30s default via `AbortController`), 408/429/5xx → `ProviderTransientError` (retried by `runner.ts`); 400/401/403 → a permanent `Error` with no key leakage. Tests use an injected `fetchImpl` — no real network calls in the suite (`src/lib/__tests__/openaiCompatProvider.test.ts`).

## 2026-07-13 — Live provider verified end-to-end on Gemini free tier
Decision: PROVIDER_MODE=live verified against Google Gemini (model `gemini-flash-lite-latest` via the OpenAI-compat endpoint); repo default remains `mock`.
Why: Full lifecycle proven live — real JSON classification, context-aware drafted reply, approval pause/resume, real rubric judge scores (1.0/criterion), 3.7s execution. Pinned model names failed for new free-tier keys (gemini-2.0-flash: free quota 0; gemini-2.5-flash: closed to new users) so the `-latest` alias is the documented default; `gemini-flash-latest` also works but 503'd intermittently during testing.
Real-LLM integration fixes this required (mock had masked all four): seed classify prompt now demands raw JSON; seed draft prompt now interpolates {{ticket/steps}} context (model had no data before); rubric+llm_judge prompts demand raw JSON {"score":...}; JSON.parse sites (transform executor + both judges) strip markdown code fences.
Revisit when: adding more providers or paid tiers.
