// Records the recruiter demo path (dashboard → run → approve → succeeded) as
// an animated GIF for the README. Pure-JS encoding (gifenc + pngjs), no ffmpeg.
// Usage: node scripts/record-demo-gif.mjs   (dev server :3000 + worker running, DB seeded)
import { chromium } from "playwright";
import gifencPkg from "gifenc";
const { GIFEncoder, quantize, applyPalette } = gifencPkg;
import { PNG } from "pngjs";
import { writeFileSync, mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT_DIR = new URL("../docs/", import.meta.url).pathname;
const OUT = `${OUT_DIR}demo.gif`;
const W = 960, H = 600; // captured at 960x600 for a README-friendly file size
const FRAME_MS = 400;   // playback delay per frame

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, colorScheme: "dark", deviceScaleFactor: 1 });

const frames = [];
let capturing = true;
async function captureLoop() {
  while (capturing) {
    try {
      const png = PNG.sync.read(await page.screenshot({ type: "png" }));
      frames.push(new Uint8ClampedArray(png.data.buffer.slice(0)));
    } catch { /* page mid-navigation; skip frame */ }
    await new Promise((r) => setTimeout(r, FRAME_MS));
  }
}

console.log("recording demo path...");
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
const recorder = captureLoop();
await page.waitForTimeout(2000);

// 1. Open the run modal from the primary CTA
await page.getByRole("button", { name: /run demo workflow/i }).click();
await page.waitForTimeout(1500);

// 2. Submit the prefilled triage input
await page.getByRole("dialog", { name: "Run workflow" }).getByRole("button", { name: "Confirm & run" }).click();

// 3. Trace page: wait for the approval pause
await page.getByText("Awaiting Approval").first().waitFor({ timeout: 60000 });
await page.waitForTimeout(1500);

// 4. Expand the approval step, then approve inline
await page.getByRole("button", { name: /Human Review/ }).click();
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Approve" }).click();

// 5. Wait for terminal success
await page.getByText(/succeeded/i).first().waitFor({ timeout: 90000 });
await page.waitForTimeout(2500);

capturing = false;
await recorder;
await browser.close();

console.log(`encoding ${frames.length} frames...`);
const gif = GIFEncoder();
for (const rgba of frames) {
  const palette = quantize(rgba, 256);
  const indexed = applyPalette(rgba, palette);
  gif.writeFrame(indexed, W, H, { palette, delay: FRAME_MS });
}
gif.finish();
writeFileSync(OUT, Buffer.from(gif.bytes()));
console.log(`wrote ${OUT} (${(gif.bytes().length / 1024 / 1024).toFixed(1)} MB, ${frames.length} frames)`);
