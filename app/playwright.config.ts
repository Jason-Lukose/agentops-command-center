import { defineConfig, devices } from "@playwright/test";

// This suite runs against the LIVE local stack — it does NOT start the dev
// server, the BullMQ worker, or Docker Postgres/Redis for you (no `webServer`
// block). Per docs/TEST_PLAN.md, before running `npm run test:e2e` you must
// already have, in separate terminals:
//   1. Docker Postgres (:5433) + Redis running (docker compose up -d)
//   2. `npm run dev`     — Next.js dev server on :3000
//   3. `npm run worker`  — BullMQ worker processing run jobs
//   4. `npm run db:seed` — seeded demo data (the triage workflow + sample runs)
// The spec asserts a helpful failure (not a hang) if :3000 is unreachable —
// see the `test.beforeAll` reachability check in e2e/demo-path.spec.ts.
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: {
    timeout: 60_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
