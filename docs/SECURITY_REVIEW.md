# Security Review

> Filled during Phase 15 (`/ship-check`) using `prompts/SECURITY_REVIEW.md`. Re-run before every deployment.
> Scope of this pass: **local-first, single-user, no-auth MVP** (`PROVIDER_MODE=mock`, no networked/paid services). Auth absence is an intentional, documented design choice per `docs/ARCHITECTURE.md` and CLAUDE.md — not a finding.

## Review Log
| Date | Reviewer model | Verdict |
|---|---|---|
| 2026-07-11 | Opus (security-reviewer) | **SAFE FOR LOCAL DEMO** — no High findings; 3 Low notes |

## Verdict

**SAFE FOR LOCAL DEMO.** No High or Medium findings. Nothing blocks local/personal use. All Low findings are DoS-adjacent footguns that are acceptable given the single-user, non-networked deployment model. **Not cleared for public/internet deployment** — that crosses a human checkpoint (auth + hardening required first; see backlog).

## Checklist Results

### Secrets
- [x] **No secrets committed.** Repo has *zero* git commits (`git log` empty) — nothing has ever entered history. Nothing to scrub.
- [x] `.env` gitignored — covered by BOTH root `.gitignore` (`.env`, `.env.*`, `!.env.example`) and `app/.gitignore` (`.env*`). `git status` confirms `.env` is untracked.
- [x] `app/.env` contains only **local dev credentials** (`postgresql://agentops:agentops@localhost:5433`, `redis://localhost:6379`, `PROVIDER_MODE=mock`) — no real/cloud secrets, no API keys. `.env.example` mirrors the same local defaults with no real values.
- [x] Least-privilege / spend cap: N/A in MVP — no external API key exists (`PROVIDER_MODE=mock`). Real provider = future human checkpoint.

### Input handling
- [x] **Every mutating route validates with zod at the boundary.** `POST /api/runs` (`runCreateSchema`), `POST/PUT /api/workflows` (`workflowCreateSchema`), approve/reject (`approvalActionSchema`). Query params validated too (`runListQuerySchema`, `evaluationListQuerySchema`, `dashboardQuerySchema` — with `z.coerce.number().int().min().max()` bounds on `limit`).
- [x] Malformed JSON is handled — `req.json().catch(() => undefined)` → zod rejects with clean 400, no crash. Verified live.
- [x] **No raw SQL.** All data access via Prisma typed client; grep for `$queryRaw`/`$executeRaw`/`Unsafe` = none.
- [x] **No XSS surface.** No `dangerouslySetInnerHTML`/`innerHTML` anywhere. Untrusted run/step output rendered via React (auto-escaped) and `JsonPanel` uses `<pre>{JSON.stringify(...)}</pre>`.
- [x] **No shell/eval/path-traversal from user input.** No `child_process`, `execSync`, `eval`, or `new Function`. No filesystem access driven by user input.

### Injection surfaces (deep-dived per task)
- [x] **`src/lib/template.ts` `{{...}}` resolver — SAFE.** Pure read-only property-path traversal (`getPath`). No writes → **no prototype pollution** (even a `__proto__` key only *reads*, never assigns). `process`/`global`/`env` are **not reachable**: the context is built solely from `buildStepContext(runInput, priorOutputs)` (a plain object) — `{{process.env.X}}` resolves against a context with no `process` key → `""`. `buildStepContext` uses object spread (`{...runInput}`) which copies own properties by data-property definition, not via prototype setters — no pollution vector.
- [x] **`src/lib/executors/transform.executor.ts` DSL — SAFE.** No `eval`/`Function`. Whitelist only: `JSON.parse(path)`, `JSON.stringify(path)`, or a plain path matching `^[a-zA-Z0-9_$.[\]]+$`. Anything else throws. The existing test `transform.executor.test.ts:53` confirms `require('fs').readFileSync('/etc/passwd')` is rejected.
- [x] **SSRF / network egress — NONE.** `toolApi.executor.ts` dispatches to `callMockTool` in `toolRegistry.ts`, which pattern-matches canned in-memory responses. Grep confirms **no `fetch`/`axios`/`http`/`net`/`dns`** in executors, providers, or runner. Step-config URLs (even with `{{...}}` templating) can never cause a real outbound request.

### Errors & logging
- [x] **No internal leakage.** `withErrorHandling` (`src/lib/errors.ts`) masks any non-`ApiError` throw as a generic `{ code: "internal_error", message: "An unexpected error occurred" }` 500 and logs the real error server-side only. Verified live on `:3000`: malformed body → clean 400 envelope; missing run/workflow → 404 with only the (non-sensitive) id echoed. No stack traces, SQL, or file paths in any response.
- [x] Logs (`console.error`) contain error objects + run ids only — no secrets/tokens/passwords (none exist in the system).

### Auth & access
- [x] **No auth by design** — single local user, documented in `docs/ARCHITECTURE.md`. Acceptable for local/personal deployment. IDOR is N/A (single trust principal, no per-user ownership on any model). Must be revisited before any public deployment (backlog).

### Data & privacy
- [x] **No PII stored.** Prisma models (`Workflow`, `WorkflowStep`, `Run`, `StepExecution`, `EvaluationResult`) hold workflow definitions and run traces only — no emails, names, passwords, or personal records. All user content is opaque `Json` the operator supplies to themselves.

### Dependencies
- [x] `npm audit`: **5 moderate, 0 High/0 Critical.** All are build/dev-tooling, not runtime-exploitable in a local demo:
  - `postcss <8.5.10` (CSS stringify XSS) — pulled by Next build tooling, not request-path.
  - `@hono/node-server` middleware bypass — pulled transitively via `@prisma/dev`/`prisma` CLI dev tooling, not the app runtime.
  - No action required for local demo. Do not `audit fix --force` (it downgrades Next to 9.x — a breaking change). Track for post-MVP.
- [x] No CORS config → same-origin default (correct — the API has no cross-origin need). `next.config.ts` is empty/default, no debug backdoors.

## Findings

### SR-1 — No request body / payload size limit on JSON routes [LOW] — OPEN
Exploit scenario: a local caller `POST`s a multi-MB body or deeply nested JSON to `/api/runs` or `/api/workflows`. `req.json()` buffers it and `jsonValueSchema` (`z.lazy` recursive) walks arbitrary depth, spending CPU/memory. Self-inflicted only (single local user); no external attacker in the MVP model.
Fix (post-MVP, before any public exposure): cap body size (reverse-proxy limit or explicit `Content-Length` check) and add `.max()` on string fields + a depth/size guard on `jsonValueSchema`.

### SR-2 — Unbounded workflow step count / config size [LOW] — OPEN
Location: `src/lib/validation/schemas.ts:26` (`steps: z.array(...).min(1)` — no `.max()`) and `config: jsonValueSchema.default({})` (no size bound). A workflow with thousands of steps or a huge `config` blob is accepted and later executed sequentially by the runner.
Exploit scenario: local user creates a pathologically large workflow, tying up the worker. Self-inflicted, local-only.
Fix (post-MVP): add `.max(50)` (or similar) to `steps` and bound `config` serialized size.

### SR-3 — Unbounded run creation [LOW] — OPEN
Location: `POST /api/runs` — no rate limit; each call creates a `Run` row and enqueues a BullMQ job.
Exploit scenario: a script loops `POST /api/runs`, filling Postgres and the Redis queue. Local single-user scope makes this a self-inflicted footgun, not an attack.
Fix (post-MVP / pre-deploy): add per-IP or global rate limiting once the app is network-reachable.

## Accepted Risks
<!-- Risks the USER explicitly accepted, with date and rationale. Claude may not accept risks unilaterally. -->
- (none recorded — SR-1/2/3 are documented Low notes, not yet formally accepted. Only the USER may accept them, with date.)

## Post-MVP Security Backlog
Mirror into `tasks/BACKLOG.md`:
1. **Before any public/internet deployment (human checkpoint):** add auth (single shared password or one managed magic-link provider per CLAUDE.md), enforce HTTPS, and add per-object ownership if multi-user.
2. Request body size limits + JSON depth/size guards (SR-1).
3. `.max()` bounds on `steps` array and `config` size (SR-2).
4. Rate limiting on run creation and other mutating routes (SR-3).
5. Resolve the 5 moderate `npm audit` items on a normal upgrade path (do **not** `--force`; it downgrades Next). Re-audit each dependency bump.
6. When `PROVIDER_MODE` flips to a real LLM provider (human checkpoint): scope the key least-privilege, set spend/token caps, and re-review prompt-injection exfiltration paths (system-prompt override, output-as-instruction).
