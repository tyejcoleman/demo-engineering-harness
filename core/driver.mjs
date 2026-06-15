// The agent driver: turns a "job" into a STREAM of PanelSpec events describing the
// build/run process — projected live as generative UI (the recursion engine).
// Live mode spawns Claude Code as the generator (gated by env). The deterministic
// FALLBACK is what ships on stage, so the wow never depends on a live model call.
import { repair } from "./renderer.mjs";
import { spawnSync } from "node:child_process";

export function planFor(job) {
  const name = (job && job.name) || "demo";
  return [
    `Read spec for "${name}"`,
    "Scaffold module + probe",
    "Generate UI panels",
    "Run behavioral probe",
    "Record convergence",
  ];
}

export function runDriverFallback(job) {
  const name = (job && job.name) || "demo";
  const steps = planFor(job);
  const events = [
    { type: "note", kind: "info", title: "Agent driver", body: `Building "${name}" (deterministic fallback).` },
    { type: "plan", title: "Build plan", steps },
    ...steps.map((label) => ({ type: "step", label, status: "done" })),
    { type: "metric", label: "Panels emitted", value: steps.length + 3 },
    { type: "note", kind: "success", title: "Done", body: `"${name}" build stream complete.` },
  ];
  return events.map(repair);
}

export async function* streamDriver(job, opts = {}) {
  const delay = opts.delayMs ?? 0;
  for (const ev of runDriver(job, opts)) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    yield ev;
  }
}

// Live generator (Claude Code) is enabled only when explicitly configured; the probe
// and the on-stage path always use the deterministic fallback above.
export function liveModeAvailable() {
  return process.env.FORGE_AGENT === "claude-code";
}

// Live mode: spawn Claude Code as the generator. Flat-subscription = known/zero marginal
// token cost vs. metered API calls. Returns PanelSpec events; throws if CC is unavailable.
export function runDriverLive(job) {
  const name = (job && job.name) || "demo";
  const prompt =
    `Output ONLY a JSON array of Forge PanelSpec objects describing how you would build the demo "${name}". ` +
    `Allowed types: note{title,body,kind}, plan{title,steps[]}, step{label,status}, metric{label,value,unit}. No prose.`;
  const res = spawnSync("claude", ["-p", prompt], { encoding: "utf8", timeout: 90000 });
  if (res.status !== 0 || !res.stdout) throw new Error("claude-code unavailable");
  const m = res.stdout.match(/\[[\s\S]*\]/);
  if (!m) throw new Error("no JSON array in claude output");
  const arr = JSON.parse(m[0]);
  if (!Array.isArray(arr) || !arr.length) throw new Error("empty generation");
  return arr.map(repair);
}

// Unified entry: live Claude Code when configured, deterministic fallback otherwise.
// The stage path always resolves to a valid stream — a live failure degrades, never breaks.
export function runDriver(job, opts = {}) {
  if (opts.live || liveModeAvailable()) {
    try {
      return runDriverLive(job);
    } catch {
      // fall through to deterministic fallback — stage never breaks
    }
  }
  return runDriverFallback(job);
}
