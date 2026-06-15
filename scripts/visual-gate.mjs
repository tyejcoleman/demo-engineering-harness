// Deterministic visual gate (no model): headless-render each route and assert no horizontal
// overflow and nothing rendered off-screen. Repeatable, so the loop can converge the LOOK,
// not just the logic. Complements the model-vision UX audit (Claude Code + Playwright MCP).
// Requires the app running at FORGE_BASE_URL (default http://localhost:5178).
import { chromium } from "playwright";

const BASE = process.env.FORGE_BASE_URL || "http://localhost:5178";
// Streaming pages get ?live=0 (deterministic, no model spawn) so the gate is fast + free.
const ROUTES = ["/", "/demo", "/sandbox", "/copilot?live=0", "/improve?live=0", "/status", "/productionize", "/preview"];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const failures = [];

for (const route of ROUTES) {
  try {
    await page.goto(BASE + route, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(500);
  } catch {
    failures.push(`${route}: did not load`);
    continue;
  }
  const issues = await page.evaluate(() => {
    const out = [];
    const vw = window.innerWidth;
    if (document.documentElement.scrollWidth > vw + 4) out.push("horizontal-overflow");
    const els = Array.from(document.querySelectorAll("h1,h2,h3,p,article,section,a,button,table"));
    for (const el of els) {
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.left < -4 || r.right > vw + 4) {
        out.push("offscreen:" + el.tagName.toLowerCase());
        break;
      }
    }
    return out;
  });
  for (const i of issues) failures.push(`${route}: ${i}`);
}

await browser.close();
console.log(failures.length === 0 ? "PASS" : "FAIL: " + failures.join("; "));
process.exit(failures.length === 0 ? 0 : 1);
