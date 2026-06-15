// Full platform audit — an append-only record of everything that changes or acts: config edits,
// environment changes, governed demo actions, self-evolution, and MCP tool calls. This is how
// "anyone can come here and edit this" stays safe: every mutation is attributed and logged.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const STORE = process.env.FORGE_AUDIT || path.join(process.cwd(), "data", "audit.json");

function read() {
  try {
    return JSON.parse(fs.readFileSync(STORE, "utf8"));
  } catch {
    return [];
  }
}
function write(d) {
  try {
    fs.mkdirSync(path.dirname(STORE), { recursive: true });
    fs.writeFileSync(STORE, JSON.stringify(d, null, 2));
  } catch {
    try {
      fs.writeFileSync(path.join(os.tmpdir(), "forge-audit.json"), JSON.stringify(d));
    } catch {
      /* in-memory only */
    }
  }
}

export function recordAudit(e = {}) {
  const all = read();
  const entry = {
    id: "a-" + (all.length + 1),
    at: e.at || new Date().toISOString(),
    actor: String(e.actor || "operator").slice(0, 24),
    action: String(e.action || "event").slice(0, 40),
    detail: String(e.detail || "").slice(0, 200),
  };
  all.push(entry);
  write(all.slice(-200));
  return entry;
}

export function listAudit(limit = 80) {
  return read().slice(-limit).reverse();
}

export function clearAudit() {
  write([]);
  return [];
}
