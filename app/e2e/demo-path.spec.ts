import { test, expect } from "@playwright/test";

// ASSUMPTION (per task spec): this suite runs against an ALREADY-RUNNING
// live local stack — Next.js dev server on :3000, the BullMQ worker, and
// Docker Postgres (:5433) / Redis, all started and seeded beforehand. This
// file intentionally does NOT orchestrate starting the worker (Playwright's
// `webServer` config only manages a single process well, and the worker is
// a separate long-lived process outside the Next.js app). See
// playwright.config.ts and docs/TEST_PLAN.md for the exact startup steps.
//
// Flake note: the mock provider intentionally fails ~8% of individual step
// calls to exercise retry behavior (see FINAL_HANDOFF.md / app/README.md).
// With 3 retries per step, a full demo run's residual failure probability
// is documented at ~0.2% — rare but nonzero. We retry the whole scenario
// once so a true one-in-500 provider flake doesn't fail CI/local runs; a
// second consecutive failure is treated as a real regression, not flake.
test.describe.configure({ retries: 1 });

test.describe("guided demo path", () => {
  test.beforeAll(async ({ request }) => {
    // Fail fast with a clear message rather than letting every test time out
    // opaquely if the dev server isn't up.
    try {
      const res = await request.get("http://localhost:3000/api/workflows", { timeout: 5000 });
      if (!res.ok()) {
        throw new Error(`Got HTTP ${res.status()}`);
      }
    } catch (err) {
      throw new Error(
        "AgentOps dev server is not reachable at http://localhost:3000. " +
          "This e2e suite runs against a LIVE local stack — start Docker " +
          "Postgres/Redis, `npm run dev`, and `npm run worker` (and " +
          "`npm run db:seed` at least once) before running `npm run test:e2e`. " +
          `Original error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  });

  test("run demo workflow -> approve -> succeeded trace with 6 steps and eval results", async ({
    page,
  }) => {
    // 1. Dashboard loads with metric cards + recent runs table.
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Total Runs")).toBeVisible();
    await expect(page.getByText("Success Rate")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent runs" })).toBeVisible();
    // Seeded DB has historical runs, so the table (not the empty state) renders.
    await expect(page.getByRole("table")).toBeVisible();

    // 2. Open "Run demo workflow" -> modal resolves the triage pipeline with
    // a prefilled JSON sample input.
    await page.getByRole("button", { name: "Run demo workflow" }).click();
    const dialog = page.getByRole("dialog", { name: "Run workflow" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Support Ticket Triage Pipeline/i)).toBeVisible();
    const inputTextarea = dialog.getByLabel("Input (JSON)");
    await expect(inputTextarea).toBeVisible();
    const prefilled = await inputTextarea.inputValue();
    expect(prefilled).toContain("ticket");
    expect(() => JSON.parse(prefilled)).not.toThrow();

    // 3. Submit -> navigates to the run trace page.
    await dialog.getByRole("button", { name: "Confirm & run" }).click();
    await page.waitForURL(/\/runs\/[^/]+$/);

    // 4. Poll for "Awaiting Approval" status badge (UI polls every 2s; the
    // run takes a few seconds to reach the approval step, plus mock-provider
    // retry latency — generous timeout).
    await expect(page.getByText("Awaiting Approval").first()).toBeVisible({ timeout: 60_000 });

    // 5. The "Human Review" step card must be expanded (click) before its
    // Approve/Reject actions are revealed — the trace viewer only
    // auto-expands a step on initial mount if it's already
    // awaiting_approval/failed; a step that transitions into that status
    // later (via polling) stays collapsed until clicked, matching the
    // existing manual screenshot-capture script's behavior.
    await page.getByRole("button", { name: /Human Review/ }).click();
    await page.getByRole("button", { name: "Approve" }).click();

    // 6. Wait for the run to reach "Succeeded" (retries can add real time).
    await expect(page.getByText("Succeeded").first()).toBeVisible({ timeout: 60_000 });

    // 7. Trace shows all 6 triage-pipeline steps, and at least one
    // evaluation result entry is present.
    await expect(page.getByText("#1")).toBeVisible();
    await expect(page.getByText("#6")).toBeVisible();
    await expect(page.getByText("#7")).toHaveCount(0);

    await expect(page.getByRole("heading", { name: "Evaluation results" })).toBeVisible();
    // At least one eval row renders a Passed/Failed outcome label.
    await expect(page.getByText(/^(Passed|Failed)$/).first()).toBeVisible();
  });
});
