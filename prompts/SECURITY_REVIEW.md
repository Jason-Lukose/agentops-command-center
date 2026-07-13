# SECURITY REVIEW PROMPT (Phase 15 input)

**Recommended model: Opus.** Role: security-reviewer.

Scope: an MVP built by a solo founder. The goal is "not embarrassing, not negligent" — protect user data and secrets, block the common attacks. Do NOT demand enterprise controls (SOC2, WAFs, pen tests, key rotation ceremonies) — flagging those as "future work" is fine; blocking on them is not.

Write findings to `docs/SECURITY_REVIEW.md` using its template: finding, severity, exploit scenario, fix, status.

## Checklist — verify each in the actual code, don't assume

### Secrets
- [ ] No API keys, passwords, tokens in source, config, or **git history** (`git log -p | grep -iE 'key|secret|token|password'` on suspicion)
- [ ] `.env` gitignored; `.env.example` documents every variable without values
- [ ] Keys are least-privilege (read-only where possible, scoped, spend-capped for AI APIs)

### Input handling
- [ ] Every external input (forms, query params, JSON bodies, file uploads, webhook payloads) validated for type/length/range at the boundary
- [ ] SQL via parameterized queries/ORM — grep for string-built queries
- [ ] User content escaped on output (XSS) — check any `dangerouslySetInnerHTML` / `innerHTML` / template injection
- [ ] No user input passed to shell commands, `eval`, file paths (path traversal), or LLM system prompts without constraint

### Auth & access (only for what the app actually has)
- [ ] If auth exists: passwords hashed with a real KDF (bcrypt/argon2), sessions httpOnly, logout works
- [ ] Every endpoint that should require auth actually checks it (list endpoints, check each)
- [ ] Object-level access: user A cannot fetch user B's records by changing an ID (IDOR)
- [ ] If NO auth by design: confirm the deployment model makes that acceptable (local/personal use), and say so in the review

### Data & privacy
- [ ] What personal data is stored? Is each field actually needed for MVP?
- [ ] Errors shown to users don't leak stack traces, queries, or internal paths
- [ ] Logs don't contain passwords, tokens, or full personal records
- [ ] HTTPS assumed/enforced in deployment plan

### AI-specific (if the app calls LLMs)
- [ ] User input can't override system instructions to exfiltrate other users' data or secrets
- [ ] Model output treated as untrusted (not executed, not rendered as raw HTML)
- [ ] Spending limits / max-token caps set on API usage

### Dependencies & platform
- [ ] `npm audit` / `pip-audit` (or equivalent) run; High/Critical vulns addressed or justified
- [ ] Debug modes / default credentials off in deployment config
- [ ] CORS not `*` if the API has any auth or private data

## Output
1. `docs/SECURITY_REVIEW.md` updated with all findings (including "checked, OK" lines — absence of evidence ≠ evidence of absence).
2. Verdict: **CLEAR TO DEPLOY** / **BLOCKED** (list blocking findings — any High = blocked).
3. Post-MVP security backlog items → `tasks/BACKLOG.md`.
