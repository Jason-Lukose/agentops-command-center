# UX Flow

> Filled during Phase 7 (`/plan-project`). Every MVP story gets a full flow; every screen traces to a story.
> Status: FILLED (flows) — 2026-07-11. Visual/motion design system stubbed for the frontend design pass.

## App Shell (present on all screens)
- Left **sidebar nav**: Dashboard, Workflows, Runs, Evaluations.
- **Top bar**: app title, mock-mode badge ("Mock Provider — no API keys"), and a **run/queue status indicator** (e.g., "2 running · 1 awaiting approval").
- Main content area renders the active screen.

## Screen Inventory
| Screen | Purpose | Serves |
|---|---|---|
| Dashboard | Health overview: metric cards, recent runs, eval summary | R9, R11, R12 |
| Workflows list | Browse/create workflows | R1, R11 |
| Workflow builder/detail | Edit ordered steps; launch a run | R1, R2, R3 |
| Runs list | History of all runs with status | R3, R5, R4 |
| Run trace viewer | Per-step timeline, I/O, status, latency, errors, cost placeholders | R5, R8, R6 |
| Evaluations view | Aggregate eval history + per-run eval results | R7, R5 |
| Approval interaction (modal/inline panel, not a standalone screen) | Approve/reject a paused run | R6 |

## Flows

### Flow: Author a workflow (R1, R2)
1. Sidebar → **Workflows** → shows workflows list. Click **New workflow** → builder opens with name/description fields and an empty step list.
2. Add steps via **Add step** → pick one of 5 types → inline config panel for that type → step appears in the ordered list. Reorder (up/down), edit, or delete steps.
3. **Save** persists the workflow; it now shows a **Run** action.
- Empty state: builder with zero steps shows a prompt "Add your first step to make this workflow runnable"; Run is disabled.
- Loading state: skeleton rows while the workflow loads; save button shows a spinner while persisting.
- Error state: save failure or empty-steps save shows an inline error banner with the reason and keeps the form data; validation message on empty/invalid step config; user can correct and retry.

### Flow: Run a workflow (R3, R4, R10) — CORE ACTION, ≤ 3 clicks
Fast path from app open: (1) Dashboard "Run sample workflow" **or** Workflows → sample → (2) **Run** → (3) enter/accept input → confirm. ≤ 3 clicks.
1. On a saved workflow's detail, click **Run** → input modal (pre-filled sample input for the seed workflow).
2. Confirm → API enqueues a BullMQ job, creates the Run, and immediately navigates to the **trace viewer** for that run (run shown as `QUEUED`/`RUNNING`).
3. Steps update in order as the worker progresses (poll/refresh).
- Empty state: input modal defaults to the sample payload so the viewer never faces a blank required field.
- Loading state: run status indicator + per-step `PENDING → RUNNING` badges with skeletons for not-yet-produced output.
- Error state: a failed step shows a `FAILED` badge + error panel + retry count; the run continues to its terminal status. If the worker is down, run stays visibly `QUEUED` with a hint "worker not processing — check the worker process," never silently stuck.

### Flow: Approve/reject a paused run (R6)
1. When a run reaches a `HUMAN_APPROVAL` step it becomes `PAUSED_FOR_APPROVAL`; the top-bar status indicator increments "awaiting approval," and the trace viewer shows an **Approval required** panel with the step's input/prior output and **Approve** / **Reject** buttons.
2. **Approve** → run resumes from the next step → proceeds to terminal status; decision + timestamp recorded and shown in the trace.
3. **Reject** → run terminates `REJECTED`; remaining steps show as not-executed; decision recorded and shown.
- Empty state: no pending approvals → indicator hidden; nothing to act on.
- Loading state: after clicking Approve/Reject, buttons disable with a spinner until the decision is persisted and the run state refreshes.
- Error state: if the decision fails to submit, an inline error appears and the buttons re-enable so the user can retry; run stays paused (no lost state).

### Flow: Inspect a trace (R5, R8)
1. Sidebar → **Runs** (or a dashboard "recent runs" row) → runs list → click a run → **trace viewer**.
2. Timeline of expandable step cards in execution order; each card shows type, status badge, latency, retry count, token/cost estimate (labeled placeholder).
3. Expand a card → input/output panels; failed steps also show an error panel; approval steps show the decision + timestamp.
- Empty state: runs list with no runs shows "No runs yet — run the sample workflow" CTA linking to the seed workflow.
- Loading state: skeleton step cards while the run loads; live status badges for in-progress runs.
- Error state: if a run fails to load, show an error card with a Retry button; a run's own step errors are shown as data (error panels), not app errors.

### Flow: Review evaluations (R7, R5)
1. Sidebar → **Evaluations** → aggregate eval history: pass rate, recent scores, list of eval results linked to their runs.
2. Click an eval result → jumps to that run's trace with the `EVALUATION` step expanded, showing check type, score, pass/fail, and target output.
- Empty state: "No evaluations yet — run a workflow that includes an evaluation step."
- Loading state: skeleton list + summary tiles.
- Error state: load failure shows an error card with Retry.

### Flow: Read the dashboard (R9, R11, R12)
1. App open → **Dashboard** (default route) → metric cards (total runs, success rate, avg latency, failed steps), recent runs list, eval summary.
2. Click a recent run → trace viewer; click **Run sample workflow** → core run flow above.
- Empty state (fresh DB before seed/first run): cards show a friendly zero-state with a "Run the sample workflow" CTA — never NaN/blank.
- Loading state: skeleton metric cards + list rows.
- Error state: metrics fetch failure shows a non-blocking error banner with Retry; the rest of the shell stays usable.

## Guided demo path (2-minute recruiter click-through, uses seed data)
Pre-req: `docker compose up` (Postgres + Redis) + seed command run; app launched in mock mode (default).
1. **Land on Dashboard** — already populated by seed data: real metric cards, recent runs (a success, a failure, an approved run), eval summary. Immediately reads as a working ops tool.
2. **Open a completed run's trace** from "recent runs" — expand step cards to show input/output, latency, retry count, cost placeholders, and a `FAILED` step's error panel. This is the "wow, real observability" moment.
3. **Run the sample workflow** ("Run sample workflow" → confirm pre-filled input) — watch steps progress live in the trace.
4. **Hit the approval checkpoint** — the run pauses; click **Approve** and watch it resume to completion (optionally re-run and **Reject** to show the other path).
5. **Open Evaluations** — show deterministic + rubric scores and the judge placeholder, with stored history tying back to runs.
Total: dashboard → trace → run → approve → evaluations, all with no API keys.

## UX quality gate
- [x] ≤ 3 steps from app open to the core action (Dashboard "Run sample workflow" → confirm input → running).
- [x] Every flow has empty / loading / error states defined.
- [x] Every user action gives visible feedback (status badges, spinners, indicators).
- [x] No dead ends — every error state has a Retry or a corrective path; paused runs never lose state.

## Visual & Motion Design System
> Source: `ui-ux-pro-max` skill design-system output for "AI developer tool observability dashboard SaaS" (density 8/10, motion 4/10), adapted to Framer Motion. Authoritative for all frontend work.

### Identity
Dark-first developer tool ("code dark + run green"). Cinematic, technical, precise — LangSmith/Vercel/Linear energy, not a consumer app. Dark mode only for MVP (recruiter demo + developer-tool credibility; light mode deferred — documented in DECISIONS.md).

### Color tokens (CSS variables in `globals.css`, referenced via Tailwind)
| Token | Hex | Use |
|---|---|---|
| `--color-background` | `#0F172A` | App background (slate-900) |
| `--color-surface` | `#1E293B` | Cards, panels, sidebar (slate-800) |
| `--color-muted` | `#272F42` | Hovers, skeleton base, table stripes |
| `--color-border` | `#334155` | Borders/dividers (475569 only for emphasis) |
| `--color-foreground` | `#F8FAFC` | Primary text |
| `--color-foreground-muted` | `#94A3B8` | Secondary text (meets 4.5:1 on surface) |
| `--color-accent` | `#22C55E` | Primary actions, success, "run" affordances |
| `--color-destructive` | `#EF4444` | Failures, destructive actions |
| `--color-warning` | `#F59E0B` | awaiting_approval, retries |
| `--color-info` | `#38BDF8` | running status, links |

Status semantics (badges, trace timeline, charts — always icon + label, never color alone):
queued=slate, running=info (pulse), awaiting_approval=warning, succeeded=accent, failed=destructive, canceled=muted-gray.

### Typography & spacing
- Inter (300–700) via `next/font/google`; mono font (Geist Mono, already scaffolded) for IDs, JSON payloads, latencies.
- Type scale: 12 (labels/badges) / 14 (body-dense, tables) / 16 (body) / 18 (section h) / 24 (page h) / 32 (dashboard metrics). `tabular-nums` on ALL numeric data.
- Dense dashboard spacing scale (8/10 density): 4 / 8 / 12 / 16 / 24 / 32; page gutter 24–32; card padding 16–20; max content width 1440 centered.
- Icons: `lucide-react` only, 16/20px, stroke 1.5–2, never emoji.

### Component vocabulary
Metric card (value + delta + sparkline placeholder) · StatusBadge · Run table row · Expandable step card (trace) · JSON I/O panel (mono, collapsible, copy button) · Error panel (destructive-tinted, message + retry count) · Skeleton blocks · Modal/dialog · Empty state (icon + one-liner + primary action) · Sidebar nav item with active indicator.

### Motion system (Framer Motion — deliberate, small, consistent)
Tokens (define once in `src/lib/motion.ts`):
- Durations: `fast: 0.15s` (hover/press), `base: 0.25s` (enter/expand), `slow: 0.4s` (page/modal). Exits ≈ 0.6–0.7× enter. Never >0.5s.
- Easing: enter `easeOut`, exit `easeIn`; springs (`type:"spring", stiffness 260–400, damping 24–34`) for expand/collapse and reorder.
- Transform/opacity ONLY. No width/height/top/left animation; no CLS.

Choreography map:
1. Page/content transitions — content fade+rise 8px on route change (template-level), `slow`.
2. Dashboard metric cards — stagger entrance 40ms/card, fade + y:12.
3. Workflow builder — `AnimatePresence` on step add/remove; `layout` animation + spring on reorder; press scale 0.98 feedback.
4. Trace timeline — expand/collapse step cards with spring `layout` + content crossfade; chevron rotation 0.15s.
5. Status changes — badge crossfade on status transition; subtle pulse (opacity 0.6↔1) on `running` only.
6. Skeletons — shimmer via opacity keyframes (no spinners for >300ms loads).
7. Result reveal — success/fail panel scale 0.97→1 + fade, `base`.
8. Modals — overlay fade + panel scale 0.96→1/y:8, exit faster; scrim 50% black.
Constraints: max 1–2 animated elements per view moment; interruptible; never input-blocking; `useReducedMotion()` gates ALL of the above → durations 0 / static states (skeleton keeps a static tint).

### Accessibility gate (per skill §1)
4.5:1 text contrast on all pairs above; visible focus rings (2px accent offset); full keyboard nav incl. expandable cards and modal escape/focus trap; `aria-live="polite"` for run-status polling updates; heading hierarchy; sortable-table `aria-sort`.

### Intensified pass — 2026-07-12
Motion dial moved from ~4/10 to ~6-7/10 per explicit request ("the website should feel alive"). All additions stay inside the existing token system (`src/lib/motion.ts`): transform/opacity only (`pathLength` for SVG checkmarks), gated by `useReducedMotion()`/`prefers-reduced-motion`, ≤500ms, interruptible, no CLS. New tokens added: `springBouncy` (livelier expand/collapse + reorder, still <400ms settle), `rowContainer`/`rowItem` (faster table-row cascade), `cardHover`/`cardTap` (lift + press), `growBar` (sparkline/eval bar draw-in), `shakeOnce` (failure reveal), `checkDraw` (success checkmark path draw), `glowPulse` (opacity-only breathing glow, never animates `box-shadow` directly), `useCountUp` (number count-up hook, jumps to target under reduced motion). `fadeRise` travel bumped 8px → 12px.

Per-page additions:
- **Dashboard**: metric cards count up on value change + hover lift/press; recent-runs table rows cascade in and animate on refresh (`AnimatePresence` + `layout`); non-terminal rows get a subtle opacity shimmer; sparkline bars draw in staggered; topbar status dot pulses.
- **Trace viewer**: step cards stagger-mount with a connector line that grows in (scaleY, origin-top); expand/collapse uses `springBouncy`; JSON panels crossfade+rise on expand; running badge gets a breathing glow (opacity-only overlay); success reveal draws an animated checkmark (SVG `pathLength`) next to the status badge; failure reveal (run-level and per-step error panels) does a once-only 300ms shake.
- **Workflow builder**: step cards get a bouncier layout spring on reorder; type icons micro-rotate on hover; Save button crossfades its label to a checkmark + "Saved" on success.
- **Workflows list**: card grid stagger unchanged; cards now lift + glow the border accent color on hover.
- **Runs list**: same row-cascade + shimmer pattern as the dashboard's recent-runs table.
- **Evaluations**: score-history bars draw in staggered (shared `Sparkline` component — same fix covers the dashboard eval summary); pass-rate/total tiles count up; result rows cascade in.
- **Sidebar/shell**: nav icons micro-scale on hover (CSS `group-hover`, respects `motion-reduce:`); active-indicator `layoutId` slide was already present; page-content transitions now travel 12px instead of 8px.
