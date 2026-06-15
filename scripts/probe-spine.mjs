// Behavioral probe for Slice 0 (the spine).
// Prints PASS only if the SSE formatter is spec-correct AND the spine routes/page exist.
// Run from the repo root: `node scripts/probe-spine.mjs`.
import { existsSync } from "node:fs";
import { sseEvent } from "../core/sse.mjs";

const checks = [];

// 1. SSE formatter behaves exactly per the SSE wire format.
const out = sseEvent("tick", { n: 1 });
checks.push(["sse-format", out === 'event: tick\ndata: {"n":1}\n\n']);

// 2. Required spine surfaces exist.
checks.push(["health-route", existsSync("app/api/health/route.ts")]);
checks.push(["stream-route", existsSync("app/api/stream/route.ts")]);
checks.push(["portal-page", existsSync("app/page.tsx")]);

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
console.log(failed.length === 0 ? "PASS" : "FAIL: " + failed.join(", "));
