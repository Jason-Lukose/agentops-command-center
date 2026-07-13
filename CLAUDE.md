# CLAUDE.md — Operating Rules for This Project

You are operating inside the **AI Project Orchestrator** kit. Follow these rules in every session, with every model.

## Prime directives

1. **MVP first, always.** Build the smallest thing that proves the core value. Everything else goes to `tasks/BACKLOG.md` under "Post-MVP".
2. **Docs are the source of truth.** Before doing work, read the relevant files in `docs/` and `tasks/`. After doing work, update them. If code and docs disagree, flag it and fix the docs.
3. **One task at a time.** Pull from `tasks/NEXT_ACTIONS.md`, finish it (code + tests + doc update), then stop or pull the next.
4. **Ask only critical questions.** If a decision is reversible and low-stakes, make a reasonable assumption, record it in `docs/DECISIONS.md`, and keep moving. Only stop for the human checkpoints below.
5. **Never require a specific model.** All prompts and workflows here must run on Opus or Sonnet. Do not reference unavailable models.

## Human checkpoints — STOP and ask the user before:

- Signing up for or enabling any **paid service** (or anything with a credit card / free-trial-that-converts)
- **Public deployment** (making anything reachable on the internet)
- Adding **external API usage** (new third-party API, new API key)
- **Major scope changes** (adding/removing MVP features after scope lock)
- **Auth decisions** (adding auth, choosing a provider, changing auth model)
- **Database changes** that migrate or delete existing data, or switch database engines
- **Destructive file operations** (deleting directories, force-push, dropping tables, overwriting user data)

When a checkpoint triggers, state: what you want to do, why, cost/risk, and the alternative. Then wait.

## How the loop runs

The normal way to use this kit is a single command: **`/start-project <idea>`**. That command is an orchestrator — it runs the whole 16-phase loop itself, auto-advancing between phases and pausing ONLY at the human checkpoints above. It does this by **delegating each phase to the matching subagent via the Task tool**; each subagent in `.claude/agents/` carries its own model in frontmatter (Opus for planning/review/security, Sonnet for implementation/tests/docs), so the correct model runs each phase automatically — the user never switches models mid-loop. Run the orchestrator on Opus for best planning/review quality.

The individual slash commands remain for running one phase manually or resuming a specific step, but they are the exception, not the default flow.

## Model routing

When delegating to subagents, their frontmatter model applies automatically. When working directly (no delegation), check which model is running and route accordingly:

| Work | Model | How |
|---|---|---|
| Intake, requirements, architecture, MVP scope lock | **Opus** | `/start-project`, `/plan-project` |
| Security review, ship/no-ship, major refactor plans, hard bugs | **Opus** | `/ship-check`, `/review`, escalated `/debug` |
| Implementation, tests, UI, APIs, migrations, routine refactors | **Sonnet** | `/build-next`, `/debug`, `/refactor` |
| Normal debugging, doc updates | **Sonnet** | `/debug`, `/update-docs` |
| Formatting, changelog cleanup, summaries | **Haiku** (if available, else Sonnet) | `/update-docs` |

Inside the orchestrator, Opus-level work is handled by delegating to the Opus-tagged subagent — no model switch needed. If you are working directly on Sonnet (not via the orchestrator) and hit Opus-level work (architecture change, security decision, a bug that survived 3 fix attempts), delegate it to the relevant Opus subagent, or tell the user to rerun with Opus.

## Anti-Overbuilding Rules (hard prohibitions)

Do NOT, unless the user explicitly overrides in writing:

1. **No microservices.** One deployable unit until the MVP has real users and a measured reason to split.
2. **No premature auth complexity.** MVP default: no auth, or the simplest possible option (single shared password, or one managed provider with email magic link). No roles/permissions systems until a feature requires them.
3. **No unused dashboards.** No admin panels, analytics screens, or settings pages that no MVP user story requires.
4. **No extra AI agents/features** beyond what the MVP user story needs. One model call that works beats an agent swarm that doesn't.
5. **No speculative scaling.** No caching layers, queues, read replicas, CDNs, or sharding for imagined load. Handle the load you have.
6. **No abstract repository/service layers** before there are at least two real implementations. Call the database directly until it hurts.
7. **No complex CI/CD before the app works locally.** Local run + tests first; a single deploy script second; pipelines later.
8. **No paid tools before a free/manual path is tested.** Prove the workflow manually or on a free tier first (this is also a human checkpoint).
9. **No rewriting large parts of the codebase without a diagnosis.** Every refactor or rewrite starts with a written problem statement in `docs/DECISIONS.md` and follows `prompts/REFACTOR_LOOP.md`.

When tempted to violate one, write the temptation into `tasks/BACKLOG.md` under "Post-MVP" instead.

## Working conventions

- **Definition of done** for any task: code written, tests pass locally, error paths handled, relevant doc updated, entry added to `docs/CHANGELOG.md`, task checked off in `tasks/`.
- **Debugging** follows `prompts/DEBUG_LOOP.md`: reproduce → isolate layer → inspect → hypothesize → smallest safe fix → regression test → log in `tasks/BUGS.md`.
- **Decisions**: any non-obvious choice (library, pattern, tradeoff) gets a one-line entry in `docs/DECISIONS.md` with date and rationale.
- **Secrets**: never commit secrets. Use `.env` + `.env.example`. Add `.env` to `.gitignore` immediately when a project starts.
- **Assumption marking**: when assuming, write `ASSUMPTION:` in the doc so the user can scan and veto.

## File map (read before phase work)

- Loop spec & quality gates: `prompts/MASTER_AGENTIC_LOOP.md`
- Phase prompts: `prompts/*.md`
- Project state: `docs/PROJECT_BRIEF.md`, `docs/REQUIREMENTS.md`, `docs/ARCHITECTURE.md`
- Work queue: `tasks/NEXT_ACTIONS.md` → `tasks/SPRINT_PLAN.md` → `tasks/BACKLOG.md`
