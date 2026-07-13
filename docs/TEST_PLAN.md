# Test Plan

> Phase 10. Vitest. Coverage proportional to risk: thick on runner/executors/evaluators, thin on boilerplate.
> The queue is mocked — we test runner logic directly, not BullMQ itself.

## How to Run Tests

```bash
cd app
npm test               # Vitest, all
npm test -- --watch    # watch mode
npm run test:e2e       # Playwright (optional, one golden path) — deferred
```

## Test Strategy
| Area | Type | Priority | Notes |
|---|---|---|---|
| Step executors (each type) | Unit | High | mock Provider; assert StepExecution fields written |
| Workflow runner orchestration | Unit | High | mock queue + providers; test ordering, pause/resume, failure short-circuit |
| Evaluators (deterministic + rubric math) | Unit | High | pure functions; exact score/pass assertions |
| API route handlers | Integration | High | zod rejection + happy path; test DB |
| Providers (MockLLMProvider) | Unit | Medium | deterministic output + simulated latency |
| UI components | Component | Low | only where logic lives (e.g. status badge, trace timeline) |
| Golden demo path | E2E (Playwright) | Optional | create → run → approve → view trace + evals |

## DB & queue strategy
- **Runner/executor/evaluator tests:** no real DB or Redis. Inject a mocked Prisma client (or a thin
  in-memory repository stub) and a mock queue (`enqueue` spied, not executed). This isolates orchestration
  logic and keeps tests fast and hermetic.
- **API handler tests:** a real test Postgres (separate `DATABASE_URL`, `prisma migrate reset` before the
  suite) so zod → Prisma → response is exercised end-to-end; the queue is still mocked so `POST /api/runs`
  asserts an enqueue call without spinning a worker.

## Test files
> Actual layout (mirrors `src/`, not a separate `tests/` tree — updated to match the code; 114 tests / 19 files total).
```
src/
├─ lib/__tests__/                          # 14 files — runner, executors, evaluators, provider
│  ├─ llmPrompt.executor.test.ts           # calls provider, writes output + token placeholders
│  ├─ toolApi.executor.test.ts             # mocked tool registry; success + non-200 error path
│  ├─ transform.executor.test.ts           # pure mapping; bad expr → failed StepExecution
│  ├─ approval.executor.test.ts            # sets awaiting_approval and halts
│  ├─ eval.executor.test.ts                # writes EvaluationResult row(s)
│  ├─ runner.test.ts                       # ordered execution, stop-on-failure, latency calc
│  ├─ runner.approval.test.ts              # pause at approval; resume re-enqueue from correct position
│  ├─ runner.edgeCases.test.ts             # cancel-vs-worker-start race guard, etc. (B6 regression)
│  ├─ mockLlmProvider.test.ts              # deterministic-ish canned output + simulated latency
│  ├─ evaluators.deterministic.test.ts     # contains/regex/json-valid/length pass+fail; throws on empty checks (B4 regression)
│  ├─ evaluators.rubric.test.ts            # weighted scoring math, boundary at threshold
│  ├─ evaluators.rubric.edgeCases.test.ts  # provider-transient-error retry path (B5 regression)
│  ├─ evaluators.llmJudge.test.ts          # placeholder returns structured stub
│  └─ format.test.ts                       # formatting helpers
└─ app/api/__tests__/                      # 5 files — route handlers, real test Postgres
   ├─ workflows.route.test.ts              # POST valid → 201; invalid → 400 validation_error; GET 404
   ├─ runs.route.test.ts                   # POST enqueues (202); GET trace shape; unknown id → 404; limit clamp (B9 regression)
   ├─ approve.route.test.ts                # approve resumes; wrong state → 409
   ├─ reject.route.test.ts                 # reject fails; wrong state → 409
   └─ dashboard.route.test.ts              # aggregate math; successRate excludes canceled (B10 regression)
```
Playwright e2e (`npm run test:e2e`) remains deferred — not implemented (see `docs/HANDOFF.md`).

## Coverage Map (fills in as requirements land; illustrative)
| Area | Acceptance criterion | Test |
|---|---|---|
| Run execution | Steps run in `position` order; trace persisted | `src/lib/__tests__/runner.test.ts` |
| Approval pause/resume | Run halts at approval, resumes on approve | `src/lib/__tests__/runner.approval.test.ts`, `src/app/api/__tests__/approve.route.test.ts` |
| Deterministic eval | contains/regex/json-valid/length pass+fail | `src/lib/__tests__/evaluators.deterministic.test.ts` |
| Rubric scoring | Weighted score computed correctly at threshold | `src/lib/__tests__/evaluators.rubric.test.ts` |
| Input validation | Bad body → 400 `validation_error` | `src/app/api/__tests__/workflows.route.test.ts` |
| Dashboard | Success rate / avg latency / failed steps correct | `src/app/api/__tests__/dashboard.route.test.ts` |

## Status (updated by qa-tester)
- **109/109 Vitest tests passing** (`npx vitest run`), `npx tsc --noEmit` clean, `npm run lint` clean (0 errors, 0 warnings).
- Started from 62 passing tests (executors/evaluators/runner/providers/format). Added 47 tests across 8 new files closing the two named gaps: API route-handler coverage and several evaluator/runner edge cases.
- New test files:
  - `src/app/api/__tests__/workflows.route.test.ts` (15) — POST create (happy path, sequential/unique positions, missing name, zero steps, bad step-type enum, malformed JSON body), GET list (populated + empty), GET/PUT/DELETE by id (happy path + 404s + PUT validation).
  - `src/app/api/__tests__/runs.route.test.ts` (8) — POST happy path (202 + enqueue called with the new run id), missing workflowId (400), input defaulting, unknown workflowId (404, no run created), enqueue failure surfaced as 500 (not a silently stuck run), GET list filtering + empty state + invalid status filter (400).
  - `src/app/api/__tests__/approve.route.test.ts` (4) — happy path (step flips to succeeded, run requeued, enqueue called), unknown run (404), wrong-state run (409 invalid_state), double-approve (409 on the second call).
  - `src/app/api/__tests__/reject.route.test.ts` (4) — happy path (approval step + all later steps marked correctly, run terminates failed with reason), unknown run (404), wrong-state (409), double-reject (409).
  - `src/app/api/__tests__/dashboard.route.test.ts` (7) — empty state (zeroed/null, no NaN), success-rate/avg-latency/failed-step-count/eval-score-average math on a hand-built fixture, workflowId filtering, recent-runs shape.
  - `src/lib/__tests__/runner.edgeCases.test.ts` (2) — 0-step workflow completes immediately as succeeded with no step executions; executeRun on an unknown run id is a no-op.
  - `src/lib/__tests__/evaluators.llmJudge.test.ts` (4) — well-formed judge completion, non-JSON completion falls back to neutral 0.5 (parse-failure path), JSON-but-missing-score field, threshold boundary.
  - `src/lib/__tests__/evaluators.rubric.edgeCases.test.ts` (3) — `evaluateRubric` with explicit criteria weights that don't sum to 1 (2/7, 5/7), default equal-weight criteria, empty-criteria short-circuit (provider never called).
- New/extended test helper: `src/lib/__tests__/testHelpers/apiFakePrisma.ts` — an in-memory Prisma stand-in covering the broader query surface the API routes use (groupBy, aggregate, count, relation filters via `where: { run: { workflowId } }`, `$transaction`) that the runner-level `fakePrisma.ts` didn't need. Additive only; `fakePrisma.ts` itself was not modified except that `stepExecution.aggregate` was already present from a prior pass.
- Deliberately **not duplicated** (already covered by the existing 62): transform-executor malformed-JSON-input failure path (`transform.executor.test.ts`), rubric weighted-average math at the `computeRubricScore` level (`evaluators.rubric.test.ts`), llm_judge structural stub via the eval executor (`eval.executor.test.ts`).
- No code defects found while writing these tests. Two route-handler behaviors are intentional and asserted as such (not bugs): `successRate` is rounded to 3 decimals server-side (`Math.round(x*1000)/1000`), and the in-memory Prisma stand-in stores Prisma's `Prisma.JsonNull` sentinel rather than a real `null` for empty JSON columns (a fake-store fidelity gap, not a runner bug — a real Postgres round-trip returns `null`).

## Manual Test Checklist
- [ ] `docker compose up`, migrate, seed → dashboard shows seeded metrics
- [ ] Create a workflow with an approval step, run it, see `awaiting_approval`
- [ ] Approve → run resumes and succeeds; trace + eval scores populate
- [ ] Reject a run → status `failed`, reason shown
- [ ] Force a step failure (mock error) → failed step visible in trace and dashboard

## Known Gaps
- LLM-judge evaluator is a placeholder (no real model) — only its structure is tested.
- Real provider mode (`PROVIDER_MODE != mock`) untested in MVP (external API = human checkpoint).
- Concurrency/load untested — single local user, single worker by design.
