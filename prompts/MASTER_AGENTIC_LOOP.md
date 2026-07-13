# MASTER AGENTIC LOOP

The canonical 16-phase workflow. Slash commands and subagents reference this file; read the phase you're entering before working. Phases 1–8 are planning (mostly Opus), 9–14 are the build cycle (mostly Sonnet, repeated per sprint/task), 15–16 are shipping (Opus).

**Global rules:** obey `CLAUDE.md` (human checkpoints, anti-overbuilding). A phase is not done until its exit criteria are met and its quality gate passes. Gates are pass/fail — on fail, fix and re-check; don't argue with the gate.

---

## Phase 1 — Intake
- **Goal:** Turn a rough idea into a clear problem statement, target user, and core value proposition.
- **Agent:** product-manager (Opus)
- **Input:** User's raw idea (prompt), `prompts/PROJECT_INTAKE.md`
- **Output:** `docs/PROJECT_BRIEF.md` (Problem, User, Value, Success Criteria sections)
- **Exit criteria:** Brief answers: who has the problem, what the problem is, what "working" looks like in one sentence.
- **Quality gate:** A stranger could read the brief and describe the product in 30 seconds.
- **Common mistakes:** Interrogating the user with 15 questions; writing marketing copy instead of a problem statement.
- **Human checkpoint:** Only if the idea implies paid services or sensitive data from the start.

## Phase 2 — Assumptions
- **Goal:** Make every unknown explicit so the user can veto cheaply.
- **Agent:** product-manager (Opus)
- **Input:** `docs/PROJECT_BRIEF.md`
- **Output:** "Assumptions" section in `docs/PROJECT_BRIEF.md`, each line prefixed `ASSUMPTION:`
- **Exit criteria:** Assumptions cover: platform (web/CLI/etc.), users (single/multi), auth (default: none/simplest), data persistence, budget ($0 default), timeline.
- **Quality gate:** Zero hidden assumptions — anything guessed is written down.
- **Common mistakes:** Assuming multi-user + auth when a single-user tool suffices; assuming a database when a JSON file works.
- **Human checkpoint:** Ask the user (max 3–5 questions) ONLY about assumptions that would invalidate the project if wrong.

## Phase 3 — Requirements
- **Goal:** Convert brief + assumptions into testable functional and non-functional requirements.
- **Agent:** product-manager (Opus)
- **Input:** `docs/PROJECT_BRIEF.md`
- **Output:** `docs/REQUIREMENTS.md` (user stories with acceptance criteria, MoSCoW-prioritized)
- **Exit criteria:** Every Must-have has acceptance criteria a test could verify.
- **Quality gate — Requirements completeness:** each requirement has an ID, a user story, acceptance criteria, and a priority; no requirement is untestable ("should be fast" → "list loads < 2s with 100 items").
- **Common mistakes:** Requirements that are solutions in disguise ("use Redis") rather than needs.
- **Human checkpoint:** None (user reviews the doc asynchronously).

## Phase 4 — MVP Scope Lock
- **Goal:** Draw the line. Must-haves only; everything else explicitly deferred.
- **Agent:** product-manager + critic-red-team (Opus)
- **Input:** `docs/REQUIREMENTS.md`
- **Output:** "MVP Scope (LOCKED)" section in `docs/REQUIREMENTS.md`; deferred items to `tasks/BACKLOG.md` "Post-MVP"
- **Exit criteria:** MVP has ≤ 7 user-facing capabilities; critic has attempted to cut it further.
- **Quality gate — MVP scope control:** every MVP item traces to the core value proposition; nothing in scope exists "because we might need it"; the anti-overbuilding rules pass.
- **Common mistakes:** Auth, settings pages, and admin panels sneaking into MVP.
- **Human checkpoint:** **User must approve the locked scope.** Any later change to it is a "major scope change" checkpoint.

## Phase 5 — Architecture
- **Goal:** Choose the simplest stack and structure that satisfies the MVP.
- **Agent:** technical-architect (Opus)
- **Input:** `docs/REQUIREMENTS.md`
- **Output:** `docs/ARCHITECTURE.md` (stack, components, data flow, project layout, key decisions → `docs/DECISIONS.md`)
- **Exit criteria:** One deployable unit; stack justified in ≤ 3 sentences per choice; local dev story defined ("how do I run it").
- **Quality gate — Architecture sanity:** no microservices, no speculative scaling, no layers without two consumers; boring, well-documented tech preferred; the whole architecture fits on one page.
- **Common mistakes:** Choosing novel tech for fun; designing for 1M users; adding a queue "for later".
- **Human checkpoint:** If the architecture requires any paid service or external API.

## Phase 6 — Data Model
- **Goal:** Define entities, fields, relationships, and where data lives.
- **Agent:** database-engineer, reviewed by technical-architect (Opus for design; Sonnet acceptable for simple models)
- **Input:** `docs/REQUIREMENTS.md`, `docs/ARCHITECTURE.md`
- **Output:** `docs/DATA_MODEL.md`
- **Exit criteria:** Every MVP user story's data needs are covered; each entity lists fields, types, constraints, relations.
- **Quality gate — Data model correctness:** no entity without a user story needing it; keys/uniqueness/nullability stated; migration story exists (even if "delete and recreate — no real data yet").
- **Common mistakes:** Modeling future features; premature normalization of tiny datasets; skipping "what happens to existing data" once real data exists.
- **Human checkpoint:** Any change to a schema holding real user data.

## Phase 7 — UX Flow
- **Goal:** Map the screens/steps a user walks through for each MVP story.
- **Agent:** product-manager + frontend-engineer (Opus plan, Sonnet detail)
- **Input:** `docs/REQUIREMENTS.md`
- **Output:** `docs/UX_FLOW.md` (text/ASCII flows, screen inventory, empty/error/loading states)
- **Exit criteria:** Every MVP story has a start-to-finish flow including failure paths.
- **Quality gate — UI/UX flow:** no screen without a story; every flow defines empty, loading, and error states; ≤ 3 steps to the core action.
- **Common mistakes:** Designing settings/profile screens; forgetting the empty first-run state.
- **Human checkpoint:** None.

## Phase 8 — Task Breakdown
- **Goal:** Turn the plan into ordered, sized, independently completable tasks.
- **Agent:** project-coordinator (Opus)
- **Input:** All `docs/*.md`
- **Output:** `tasks/BACKLOG.md`, `tasks/SPRINT_PLAN.md`, `tasks/NEXT_ACTIONS.md`, initial `tasks/RISKS.md`
- **Exit criteria:** Sprint 1 ends with something runnable end-to-end (walking skeleton first); each task ≤ ~2 hours, has acceptance criteria and a file-level hint.
- **Quality gate:** Task 1 produces a running "hello" version of the real stack; no task depends on an undone future task; every task traces to a requirement ID.
- **Common mistakes:** Horizontal slicing ("build all models, then all APIs, then all UI") instead of vertical slices; tasks like "build backend" (too big).
- **Human checkpoint:** None.

## Phase 9 — Implementation
- **Goal:** Complete the next task from `tasks/NEXT_ACTIONS.md` — code that runs.
- **Agent:** frontend-engineer / backend-engineer / database-engineer (Sonnet)
- **Input:** The task, relevant `docs/*.md`, existing code
- **Output:** Working code; task checked off; `docs/CHANGELOG.md` entry
- **Exit criteria:** Acceptance criteria met, app runs locally, no new lint/type errors.
- **Quality gate — Error handling:** external calls have failure handling; user input is validated; errors are surfaced, not swallowed.
- **Common mistakes:** Drive-by refactoring; implementing adjacent backlog items "while I'm here"; skipping the run-it-locally check.
- **Human checkpoint:** New external API, new dependency with cost, anything destructive.

## Phase 10 — Test Creation
- **Goal:** Lock in behavior with tests proportional to risk.
- **Agent:** qa-tester (Sonnet)
- **Input:** Implemented code, `docs/REQUIREMENTS.md` acceptance criteria, `docs/TEST_PLAN.md`
- **Output:** Tests; updated `docs/TEST_PLAN.md`
- **Exit criteria:** Every acceptance criterion of completed tasks has at least one test; tests pass; core logic covered including one failure path each.
- **Quality gate — Test coverage:** happy path + at least one edge/error case per feature; tests fail when the feature is broken (spot-check by intent, not just green output); no tests that test mocks.
- **Common mistakes:** 100%-coverage theater on trivial code while the core algorithm is untested; brittle UI snapshot tests.
- **Human checkpoint:** None.

## Phase 11 — Review
- **Goal:** Independent quality pass on recent work.
- **Agent:** critic-red-team + technical-architect (Opus)
- **Input:** Diff/recent code, `docs/*.md`, `prompts/REVIEW_LOOP.md`
- **Output:** Findings in `tasks/BUGS.md` (defects) and `tasks/NEXT_ACTIONS.md` (fixes); scope drift flagged
- **Exit criteria:** Review checklist run; every finding is severity-rated and actionable.
- **Quality gate:** No High-severity finding left unaddressed or unacknowledged by the user.
- **Common mistakes:** Style nitpicks instead of correctness; rubber-stamping; "fixing" during review instead of logging.
- **Human checkpoint:** If review reveals the plan itself is wrong (major scope change).

## Phase 12 — Debugging
- **Goal:** Fix defects with the smallest safe change. Follow `prompts/DEBUG_LOOP.md` exactly.
- **Agent:** backend/frontend-engineer (Sonnet); escalate to Opus after 3 failed hypotheses
- **Input:** Bug report, `tasks/BUGS.md`
- **Output:** Fix + regression test; updated `tasks/BUGS.md`, `docs/CHANGELOG.md`
- **Exit criteria:** Bug reproduced before fix, unreproducible after; regression test added; no unrelated code touched.
- **Quality gate:** The fix's diff is proportional to the diagnosis. A one-line bug gets a small fix, not a rewrite.
- **Common mistakes:** Shotgun changes; fixing symptoms; "it works now" without knowing why.
- **Human checkpoint:** If the fix requires schema migration on real data or a destructive operation.

## Phase 13 — Refactor
- **Goal:** Improve structure of code that has proven painful — with behavior preserved.
- **Agent:** frontend/backend-engineer (Sonnet); technical-architect (Opus) for structural refactors
- **Input:** Written diagnosis in `docs/DECISIONS.md`, `prompts/REFACTOR_LOOP.md`
- **Output:** Refactored code, all tests still green, decision entry
- **Exit criteria:** Tests pass before AND after; no behavior change; diagnosis documented.
- **Quality gate:** Refactor was triggered by real observed pain (repeated bugs, can't add a feature), not aesthetics; scope stayed within the diagnosis.
- **Common mistakes:** Refactoring without tests as a safety net; scope creep into a rewrite.
- **Human checkpoint:** Any refactor touching > ~30% of the codebase (this is a major change — confirm first).

## Phase 14 — Documentation Update
- **Goal:** Make docs match reality.
- **Agent:** documentation-writer (Sonnet; Haiku for changelog/formatting)
- **Input:** Recent changes, all `docs/*.md`
- **Output:** Updated `docs/*` (esp. ARCHITECTURE, API_SPEC, DATA_MODEL, CHANGELOG), README of the built app
- **Exit criteria:** A new contributor could set up and run the project from docs alone.
- **Quality gate — Documentation readiness:** setup steps actually tested; no doc contradicts the code; CHANGELOG current; DECISIONS log has entries for every non-obvious choice.
- **Common mistakes:** Writing aspirational docs for unbuilt features; letting API_SPEC drift from actual endpoints.
- **Human checkpoint:** None.

## Phase 15 — Deployment Readiness
- **Goal:** Verify the app is safe and ready to put in front of users.
- **Agent:** devops-engineer + security-reviewer (Opus for security, Sonnet for mechanics)
- **Input:** Whole repo, `docs/DEPLOYMENT.md`, `prompts/SECURITY_REVIEW.md`
- **Output:** `docs/SECURITY_REVIEW.md`, completed `docs/DEPLOYMENT.md`, deploy script/steps
- **Exit criteria:** Security checklist done; env vars documented in `.env.example`; deploy + rollback steps written; app boots from a clean clone following the docs.
- **Quality gate — Security/privacy & Deployment readiness:** no secrets in repo/history; input validation at boundaries; error messages don't leak internals; a rollback path exists; free tier confirmed or paid checkpoint passed.
- **Common mistakes:** First deploy attempt IS the deploy docs test; hardcoded localhost URLs; missing CORS/HTTPS considerations.
- **Human checkpoint:** **Always** — public deployment and any paid service require explicit user approval.

## Phase 16 — Final Handoff
- **Goal:** Package the project so the user (or future Claude session) can own it.
- **Agent:** documentation-writer + project-coordinator (Sonnet), ship/no-ship verdict by critic-red-team (Opus)
- **Input:** Everything
- **Output:** `docs/HANDOFF.md` (what was built, how to run, known issues, deferred items, next steps), final SHIP/NO-SHIP in `docs/DECISIONS.md`
- **Exit criteria:** Handoff doc complete; open bugs and risks honestly listed; ship verdict recorded with reasons.
- **Quality gate — Handoff readiness:** the user can run, deploy, and extend the project without this conversation's context; known limitations stated plainly, not hidden.
- **Common mistakes:** Declaring victory over known-broken features; burying caveats.
- **Human checkpoint:** User accepts the handoff.

---

## Quality Gate Index (quick reference)

| Gate | Phase | One-line test |
|---|---|---|
| Requirements completeness | 3 | Every Must-have is testable and prioritized |
| MVP scope control | 4 | ≤ 7 capabilities, all trace to core value, user approved |
| Architecture sanity | 5 | One deployable unit, fits on a page, boring tech |
| Data model correctness | 6 | Every entity ← user story; constraints + migration story stated |
| API design | 9/14 | Consistent naming, versioned-by-simplicity, errors structured, spec matches code |
| UI/UX flow | 7 | Empty/loading/error states defined; ≤ 3 steps to core action |
| Security/privacy | 15 | No secrets committed; input validated; least-privilege keys |
| Test coverage | 10 | Acceptance criteria all tested; failure paths covered |
| Error handling | 9 | External calls guarded; errors surfaced with context |
| Deployment readiness | 15 | Clean-clone boot works; rollback documented |
| Documentation readiness | 14 | New contributor can run it from docs alone |
| Final handoff readiness | 16 | Project survives loss of this conversation |
