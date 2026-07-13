---
description: "Phase 15-16: security review, deployment readiness, and an explicit SHIP/NO-SHIP verdict"
argument-hint: (no arguments)
---

# /ship-check — Deployment Readiness & Ship/No-Ship

**Recommended model: Opus.** Security and ship decisions belong on the strongest available model — if not Opus, strongly recommend switching before proceeding.

Follow `prompts/FINAL_HANDOFF.md` sections 1–3 and `prompts/SECURITY_REVIEW.md`:

1. **Security review** — run the full checklist against actual code (secrets incl. git history, input validation, auth/IDOR if applicable, data exposure, AI-specific risks, dependency audit). Findings → `docs/SECURITY_REVIEW.md`. Any HIGH = blocked.
2. **Deployment readiness** — fresh-clone test of the setup docs; `.env.example` complete; deploy AND rollback steps in `docs/DEPLOYMENT.md`; cost check ($0 confirmed or paid-service checkpoint).
3. **Ship/No-Ship** — answer the checklist with evidence (run the MVP flows for real): all locked capabilities work, High bugs fixed/accepted, tests pass, docs sufficient, no unpleasant surprises. Record **SHIP** or **NO-SHIP + blockers** in `docs/DECISIONS.md`.

Human checkpoints — do NOT act without explicit user approval: actually deploying publicly, enabling any paid service, creating external accounts/keys. Prepare everything, then ask.

If SHIP: offer to complete the handoff (`prompts/FINAL_HANDOFF.md` sections 4–5 → `docs/HANDOFF.md`).
