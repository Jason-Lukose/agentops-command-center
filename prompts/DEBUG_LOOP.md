# DEBUG LOOP PROMPT (Phase 12: Debugging)

**Recommended model: Sonnet.** Escalate to Opus after 3 failed fix attempts or for concurrency/heisenbug/cross-layer issues.

Follow these steps IN ORDER. Do not skip to fixing. Do not rewrite anything you haven't diagnosed.

## The loop

### 1. Reproduce
Run the app/test and trigger the bug yourself. Record the exact steps, input, expected vs. actual. **If you cannot reproduce it, stop and gather more info** (ask the user for steps/logs) — never fix blind. Where possible, write a failing test that captures the bug NOW; it becomes your fix detector and your regression test.

### 2. Identify the failing layer
Binary-search the stack: is the bad value in the UI, the API response, the business logic, or the store? Check the data at each boundary until you find where good input becomes bad output. Name the layer before proceeding.

### 3. Inspect
Read the actual code in the failing layer, recent changes to it (`git log -p` on the file), relevant logs, and the related entry in `tasks/BUGS.md` (has this happened before?). Add temporary targeted logging if needed — and remove it after.

### 4. Hypothesize
Write down 1–3 hypotheses, most likely first, each with a prediction: "If H1 is true, then X will show Y." Test the prediction BEFORE writing a fix. A hypothesis you can't test isn't a hypothesis.

### 5. Smallest safe fix
Fix the confirmed cause with the minimum diff. Rules:
- Touch only the diagnosed code path.
- **No broad rewrites, no "while I'm here" cleanups, no restructuring.** If the diagnosis reveals a structural problem, log it in `docs/DECISIONS.md` and propose a separate `/refactor` — don't do it inside a bug fix.
- If the fix needs schema migration on real data or anything destructive → human checkpoint, ask first.

### 6. Verify + regression test
Re-run the reproduction steps — bug gone. Run the FULL test suite — nothing else broke. Keep the failing test from step 1 (now passing) as the regression test; if you couldn't write one earlier, write it now.

### 7. Record
- `tasks/BUGS.md`: symptom, root cause, fix, date — move to "Fixed".
- `docs/CHANGELOG.md`: one line.
- If the bug revealed a class of problem (e.g., "we never validate dates anywhere"), add a task to `tasks/BACKLOG.md`.

## Escalation rule
Count your fix attempts. After **3 failed hypotheses/fixes**, stop. Summarize: reproduction, layers ruled out, hypotheses tested and their evidence. Tell the user: "Escalate to Opus (`/model opus`, then `/debug` again) — here's the state." A written dead-end summary is a successful outcome; thrashing is not.

## Forbidden moves
- Changing code before reproducing
- Fixing by deleting the failing test or loosening the assertion
- Catch-and-ignore to make the symptom disappear
- Upgrading/downgrading dependencies as a first resort
- Declaring "fixed" without re-running the reproduction
