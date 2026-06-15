// Demo memory — the platform's context store of past demo runs. This is what makes the harness
// stateful: the intelligence layer reasons over this history to suggest what to demo next, and the
// self-evolution loop can mine it for gaps. File-backed; capped so it stays cheap to read.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const STORE = process.env.FORGE_HISTORY || path.join(process.cwd(), "data", "history.json");

function read() {
  try {
    return JSON.parse(fs.readFileSync(STORE, "utf8"));
  } catch {
    return [];
  }
}
function write(data) {
  try {
    fs.mkdirSync(path.dirname(STORE), { recursive: true });
    fs.writeFileSync(STORE, JSON.stringify(data, null, 2));
  } catch {
    try {
      fs.writeFileSync(path.join(os.tmpdir(), "forge-history.json"), JSON.stringify(data));
    } catch {
      /* in-memory only */
    }
  }
}

export function recordRun(run = {}) {
  const all = read();
  const entry = {
    id: "run-" + (all.length + 1),
    title: String(run.title || "Untitled").slice(0, 80),
    premise: String(run.premise || "").slice(0, 400),
    starter: String(run.starter || "").slice(0, 300),
    disposition: String(run.disposition || "—").slice(0, 24),
    qa: Math.max(0, Math.min(100, Number(run.qa) || 0)),
    action: String(run.action || "").slice(0, 40),
    at: run.at || new Date().toISOString(),
  };
  all.push(entry);
  write(all.slice(-100));
  return entry;
}

export function listRuns(limit = 50) {
  return read().slice(-limit).reverse();
}

export function runStats() {
  const all = read();
  const by = {};
  for (const r of all) by[r.disposition] = (by[r.disposition] || 0) + 1;
  const avgQa = all.length ? Math.round(all.reduce((s, r) => s + (r.qa || 0), 0) / all.length) : 0;
  return { total: all.length, byDisposition: by, avgQa };
}

export function clearRuns() {
  write([]);
  return [];
}
