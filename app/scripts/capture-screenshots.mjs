// Captures the five README screenshots against the running dev stack.
// Usage: node scripts/capture-screenshots.mjs  (dev server on :3000, worker up, DB seeded)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = new URL("../docs/screenshots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });

async function shoot(path, name, prep) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200); // let entrance animations settle
  if (prep) await prep();
  await page.screenshot({ path: `${OUT}${name}.png` });
  console.log(`captured ${name}.png (${path})`);
}

// Resolve interesting run ids from the API
const runs = await (await fetch(`${BASE}/api/runs?limit=50`)).json();
const workflows = await (await fetch(`${BASE}/api/workflows`)).json();
const triage = workflows.workflows.find((w) => /triage/i.test(w.name));
const succeededTriage = runs.runs.find((r) => r.workflowId === triage.id && r.status === "succeeded");
const awaiting = runs.runs.find((r) => r.status === "awaiting_approval");

await shoot("/", "dashboard");
await shoot(`/runs/${succeededTriage.id}`, "trace-viewer", async () => {
  // expand a couple of step cards so the trace shows I/O panels
  const stepButtons = page.getByRole("button").filter({ hasText: /Classify|Draft|Quality|Summarize/i });
  const n = await stepButtons.count();
  for (let i = 0; i < Math.min(n, 2); i++) await stepButtons.nth(i).click().catch(() => {});
  await page.waitForTimeout(800);
});
await shoot(`/workflows/${triage.id}`, "builder");
await shoot("/evaluations", "evaluations");
if (awaiting) {
  await shoot(`/runs/${awaiting.id}`, "approval", async () => {
    const approvalCard = page.getByRole("button").filter({ hasText: /Review|Approval|Human/i }).first();
    await approvalCard.click().catch(() => {});
    await page.waitForTimeout(600);
  });
}
await browser.close();
console.log("done");
