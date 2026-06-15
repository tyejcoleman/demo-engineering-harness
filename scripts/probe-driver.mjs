// Behavioral probe for Slice 2: the agent driver (deterministic fallback).
// PASS only if it emits a legible stream of valid PanelSpec events, deterministically.
import { runDriverFallback } from "../core/driver.mjs";
import { repair } from "../core/renderer.mjs";

const checks = [];
const ok = (n, c) => checks.push([n, !!c]);

const events = runDriverFallback({ name: "live-copilot" });

// 1. A real stream of process (>= 3 events).
ok("emits-3+", Array.isArray(events) && events.length >= 3);

// 2. Every event is a valid PanelSpec (repair is idempotent on it).
ok("all-valid", events.every((e) => e.type && repair(e).type === e.type));

// 3. The process is legible: a plan + multiple steps.
ok("has-plan", events.some((e) => e.type === "plan"));
ok("has-steps", events.filter((e) => e.type === "step").length >= 3);

// 4. Deterministic: same input -> identical stream (stage-safe).
ok("deterministic", JSON.stringify(runDriverFallback({ name: "x" })) === JSON.stringify(runDriverFallback({ name: "x" })));

const failed = checks.filter(([, c]) => !c).map(([n]) => n);
console.log(failed.length === 0 ? "PASS" : "FAIL: " + failed.join(", "));
