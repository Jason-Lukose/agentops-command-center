# Architecture

> AgentOps Command Center — lightweight AI-workflow observability + evaluation platform.
> Single-user, local-first, no auth, $0 budget. One deployable unit.

## Stack

| Layer | Choice | Why (≤3 sentences) |
|---|---|---|
| Frontend | Next.js App Router + TypeScript + Tailwind + Framer Motion | User-dictated; one framework serves UI and API so there is a single deployable unit. Tailwind + Framer give a polished demo with no design system to maintain. |
| Backend | Next.js Route Handlers (`app/src/app/api/**`) | Colocated with the UI in the same process — no separate API service to run or deploy. Zod validates every request boundary. |
| Data | PostgreSQL + Prisma | Runs need relational integrity (Workflow → Step → Run → StepExecution → EvaluationResult) and typed queries; Prisma gives migrations + a typed client with no hand-written SQL. |
| Queue | Redis + BullMQ | Runs execute asynchronously so the API returns immediately and approval steps can pause/resume; BullMQ is the boring standard for Node job queues. |
| Worker | `npm run worker` (tsx script, same package) | Same codebase and dependencies as the app — NOT a microservice, just a second entrypoint that consumes the queue. |
| Tests | Vitest (+ optional Playwright later) | Fast, TS-native, one test runner. Playwright deferred to a single demo-path e2e. |
| Local infra | Docker Compose (Postgres + Redis only) | Containers for stateful services only; app + worker run on the host for fast reloads. |

## Components & Data Flow

```
                         ┌─────────────────────────────────────────┐
                         │  Next.js app (app/)  — ONE deployable    │
                         │                                          │
  [Browser UI] ──HTTP──► │  Route Handlers (api/*)  ── Zod validate │
   SWR polling ◄─────────│        │                                │
   (2s interval)         │        │ Prisma                         │
                         │        ▼                                 │
                         │   [PostgreSQL] ◄──────────────┐          │
                         │        ▲                      │ Prisma   │
                         │        │ enqueue { runId }    │          │
                         │        ▼ (BullMQ)             │          │
                         │   [Redis queue]               │          │
                         └────────┼──────────────────────┼─────────┘
                                  │ same package, `npm run worker`  │
                         ┌────────▼──────────────────────┴─────────┐
                         │  Worker process (worker.ts, tsx)        │
                         │   runner → step executors               │
                         │   (llm_prompt|tool_api|transform|        │
                         │    approval|eval) → Provider interface   │
                         │   → writes StepExecution + Eval rows     │
                         └──────────────────────────────────────────┘
```

### Data flow for a run
1. `POST /api/runs` — Zod-validated body `{ workflowId, input }`. Handler creates a `Run` (status `queued`) via Prisma, enqueues `{ runId }` to BullMQ, returns `202` with the run id.
2. Worker picks up the job, sets `Run.status = running`, loads the workflow's ordered `WorkflowStep[]`.
3. For each step in `position` order the runner calls the matching executor. Each execution writes a `StepExecution` row (input, output, status, latencyMs, retryCount, token/cost placeholders). `eval` steps also write `EvaluationResult` rows.
4. `approval` step: runner sets `Run.status = awaiting_approval`, writes a `StepExecution` with status `awaiting_approval`, and **stops** (the job completes cleanly — no busy-waiting).
5. `POST /api/runs/{id}/approve|reject` updates that StepExecution and, on approve, re-enqueues `{ runId }` (worker resumes from the first non-terminal step). On reject, `Run.status = failed`.
6. On completion the runner sets `Run.status = succeeded|failed`, `finishedAt`, and `latencyMs` — `latencyMs` is the **sum of that run's `StepExecution.latencyMs`** (execution time only), not wall-clock `finishedAt − startedAt`, so time spent waiting on a human approval is excluded. The same shared helper (`executionLatencyMs` in `src/lib/runner.ts`) is used by the reject/cancel routes so `avg(latencyMs)` on the dashboard compares like with like.
7. UI reads state by **polling** `GET /api/runs/{id}` on a 2s SWR interval until a terminal status. No WebSockets in MVP.

## Project Layout

```
app/                         # the single Next.js package (one deployable unit)
├─ docker-compose.yml        # postgres:16 + redis:7 (stateful services only)
├─ .env.example              # DATABASE_URL, REDIS_URL, PROVIDER_MODE=mock
├─ package.json              # scripts: dev, build, worker, test, seed, prisma
├─ prisma/
│  ├─ schema.prisma          # models per docs/DATA_MODEL.md
│  └─ seed.ts                # 1+ polished sample workflow + completed runs/traces/evals
├─ src/
│  ├─ app/
│  │  ├─ (dashboard)/…        # UI routes: dashboard, workflows, workflow builder, run trace
│  │  └─ api/                 # Route Handlers (see docs/API_SPEC.md)
│  │     ├─ workflows/…
│  │     ├─ runs/…
│  │     └─ dashboard/route.ts
│  ├─ lib/
│  │  ├─ db.ts               # Prisma client singleton
│  │  ├─ queue.ts            # BullMQ queue + connection (shared by api + worker)
│  │  ├─ validation/         # zod schemas per boundary
│  │  ├─ errors.ts           # error envelope helper { error: { code, message, details? } }
│  │  ├─ runner.ts           # sequential orchestration, pause/resume
│  │  ├─ executors/          # one file per step type
│  │  ├─ providers/          # Provider interface, MockLLMProvider, judge placeholder
│  │  ├─ evaluators/         # deterministic, rubric, llm-judge placeholder
│  │  └─ __tests__/          # Vitest unit tests (mirrors src/lib)
│  └─ worker/
│     └─ index.ts            # BullMQ Worker entrypoint (`npm run worker`)
```

## Running Locally

```bash
cd app
cp .env.example .env
docker compose up -d              # postgres:16 + redis:7
npm install
npx prisma migrate dev            # create schema (dev DB, reset allowed)
npm run db:seed                   # sample workflow + runs + traces + evals
npm run dev                       # Next.js on :3000  (terminal 1)
npm run worker                    # BullMQ worker      (terminal 2)
npm test                          # Vitest
```

Two host processes (`dev` + `worker`) share one `.env`, one Prisma client, one queue. Everything lives in the `app/` package.

## External Services & APIs

| Service | Purpose | Cost | Env var |
|---|---|---|---|
| PostgreSQL (local Docker) | Persistence | $0 | `DATABASE_URL` |
| Redis (local Docker) | Job queue | $0 | `REDIS_URL` |
| LLM provider | Step execution / judge | $0 in MVP — `PROVIDER_MODE=mock` (no key). Real keys = human checkpoint. | `PROVIDER_MODE` (`mock`) |

No paid or networked service is required to run the MVP. Switching `PROVIDER_MODE` to a real provider is a human checkpoint (external API + API key).

## Deliberate Simplifications

- **Polling, not WebSockets** — revisit if run traces need sub-second live updates or many concurrent viewers.
- **No auth** — single local user; revisit before any public deployment.
- **Worker in the same package** — revisit only if worker load needs independent scaling/deploy.
- **No repository/service abstraction** — call Prisma directly from handlers/runner until a second data backend exists.
- **Ordered-list workflow builder, not a drag-and-drop canvas** — revisit if branching/parallel steps enter scope.
- **Mock provider default** — real LLM calls deferred behind the Provider interface; flip via `PROVIDER_MODE`.
