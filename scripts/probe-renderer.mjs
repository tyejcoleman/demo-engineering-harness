// Behavioral probe for Slice 1: the generative-UI renderer contract.
// PASS only if valid specs pass through, unknown/hostile specs degrade to a safe note,
// repair() never throws on garbage, coercion holds, and two-stream routing is stable.
import { repair, repairAll, surface } from "../core/renderer.mjs";

const checks = [];
const ok = (name, cond) => checks.push([name, !!cond]);

// 1. Valid panels keep their type.
ok("valid-note", repair({ type: "note", body: "hi" }).type === "note");
ok("valid-citation", repair({ type: "citation", source: "KB-12", quote: "x" }).type === "citation");

// 2. Unknown type degrades to a safe warn note (never passes through).
const bad = repair({ type: "script", body: "alert(1)" });
ok("unknown-degrades", bad.type === "note" && bad.kind === "warn");

// 3. Hostile / malformed input never throws.
let threw = false;
try {
  repairAll([null, 42, "x", {}, { type: "plan", steps: "nope" }, undefined]);
} catch {
  threw = true;
}
ok("no-throw-on-garbage", !threw);

// 4. Coercion: plan.steps always becomes a clean string array.
const plan = repair({ type: "plan", steps: ["a", 2, null, "b"] });
ok("plan-coerces", Array.isArray(plan.steps) && plan.steps.every((s) => typeof s === "string"));

// 5. Two-stream routing is stable.
ok("surface-graph", surface("graph") === "canvas");
ok("surface-note", surface("note") === "stream");

const failed = checks.filter(([, c]) => !c).map(([n]) => n);
console.log(failed.length === 0 ? "PASS" : "FAIL: " + failed.join(", "));
