// LOOP 2 — active-feedback store. Every live call is judged by an INDEPENDENT customer-experience
// evaluator (it is not told this is a demo); its genuine satisfaction score + critique + proposed system
// improvement are recorded here, per industry. This is the second self-improvement path: the platform
// learns from real call feedback (distinct from the offline policy-training brain in brain.mjs).
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const file = (p) => process.env.FORGE_FEEDBACK || path.join(process.cwd(), "data", `feedback-${p || "telecom"}.json`);

function read(p) {
  try {
    return JSON.parse(fs.readFileSync(file(p), "utf8"));
  } catch {
    return { runs: [] };
  }
}
function write(p, d) {
  try {
    fs.mkdirSync(path.dirname(file(p)), { recursive: true });
    fs.writeFileSync(file(p), JSON.stringify(d));
  } catch {
    try {
      fs.writeFileSync(path.join(os.tmpdir(), path.basename(file(p))), JSON.stringify(d));
    } catch {
      /* in-memory */
    }
  }
}

export function recordFeedback(profile, entry) {
  const d = read(profile);
  d.runs.push({ ...entry, at: new Date().toISOString() });
  d.runs = d.runs.slice(-50);
  write(profile, d);
  return d;
}

export function getFeedback(profile) {
  const d = read(profile);
  const all = d.runs;
  const n = all.length;
  const avgScore = n ? Math.round(all.reduce((s, r) => s + (Number(r.score) || 0), 0) / n) : 0;
  const satisfiedPct = n ? Math.round((100 * all.filter((r) => r.satisfied).length) / n) : 0;
  // recent calls (newest first) + the distinct improvement themes the evaluator keeps raising
  const recent = all.slice(-12).reverse().map((r) => ({ score: r.score, satisfied: r.satisfied, concern: r.concern, critique: r.critique, improvement: r.improvement, at: r.at }));
  const improvements = [...new Set(all.map((r) => r.improvement).filter(Boolean))].slice(-6).reverse();
  return { count: n, avgScore, satisfiedPct, recent, improvements };
}

export function clearFeedback(profile) {
  write(profile, { runs: [] });
}
