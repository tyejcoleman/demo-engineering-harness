// The Demo Manifest — the single, editable source of truth for a Forge demo. Meta-config layer:
// brand/domain/agentName flow into the agent prompts; profile swaps the whole dataset; format
// selects the POC form factor. Edit here (UI or MCP) and the live demo regenerates from it.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { PROFILES, getProfile, FORMATS } from "./profiles.mjs";

const TELECOM = getProfile("telecom");

export const DEFAULT_SPEC = {
  meta: {
    name: "Forge",
    brand: TELECOM.meta.brand,
    domain: TELECOM.meta.domain,
    agentName: TELECOM.meta.agentName,
    target: 90, // readiness / self-evolution bar
  },
  profile: "telecom", // active industry/company dataset
  format: "agent-assist", // active POC form factor
  scenarios: TELECOM.scenarios,
  knowledge: TELECOM.knowledge,
  personas: {
    customer: "A real person on the phone: short, natural, emotional, uses contractions; eases up if genuinely helped, pushes back if deflected.",
    agent: "A warm, capable human agent who takes ownership, acknowledges specifics, and avoids corporate script.",
    simulator: "A digital twin of the customer that predicts, 0–100, how likely they are to stay under each candidate strategy.",
    qa: "A post-call reviewer that scores the resolution and picks the best-fit disposition within authority.",
  },
  scoring: {
    target: 90,
    rubric: ["grounded citation (verbatim KB)", "governed action + audit", "post-call analytics", "coherent event ordering", "compliance check"],
  },
  mcp: [
    { id: "claude-code", kind: "generator", name: "Claude Code", status: "wired", tools: ["forge_manifest", "forge_configure", "forge_list_profiles", "forge_switch_profile", "forge_set_format", "forge_generate_scenario", "forge_seed_environment", "forge_suggest_demo", "forge_improve", "forge_audit"] },
    { id: "crm", kind: "data", name: "CRM (crm.read / issueCredit)", status: "seeded" },
    { id: "kb", kind: "data", name: "Knowledge base (retrieve)", status: "seeded" },
  ],
  environment: { id: "baseline", label: "Telecom · baseline", baseline: true, accounts: TELECOM.accounts },
};

const STORE = process.env.FORGE_MANIFEST || path.join(process.cwd(), "data", "manifest.json");

function isObj(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}
function deepMerge(base, over) {
  if (!isObj(base) || !isObj(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const k of Object.keys(over)) out[k] = isObj(base[k]) && isObj(over[k]) ? deepMerge(base[k], over[k]) : over[k];
  return out;
}
function readStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE, "utf8"));
  } catch {
    return null;
  }
}
function write(target, data) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(data, null, 2));
}

export function loadSpec() {
  const o = readStore();
  return o ? deepMerge(DEFAULT_SPEC, o) : structuredClone(DEFAULT_SPEC);
}

export function saveSpec(partial) {
  const merged = deepMerge(loadSpec(), partial || {});
  try {
    write(STORE, merged);
  } catch {
    try {
      write(path.join(os.tmpdir(), "forge-manifest.json"), merged);
    } catch {
      /* in-memory only */
    }
  }
  return merged;
}

export function resetSpec() {
  try {
    fs.rmSync(STORE, { force: true });
  } catch {
    /* ignore */
  }
  return structuredClone(DEFAULT_SPEC);
}

// Switch the entire dataset to an industry/company profile — brand, domain, KB, scenarios, accounts.
export function applyProfile(id) {
  const p = getProfile(id);
  return saveSpec({
    profile: p.id,
    meta: { brand: p.meta.brand, domain: p.meta.domain, agentName: p.meta.agentName },
    knowledge: p.knowledge,
    scenarios: p.scenarios,
    environment: { id: "baseline", label: `${p.label} · baseline`, baseline: true, accounts: p.accounts },
  });
}

// Select the POC form factor (e.g. agent-assist vs ai-agent).
export function setFormat(format) {
  const ok = FORMATS.some((f) => f.id === format) ? format : "agent-assist";
  return saveSpec({ format: ok });
}

// Scenario management — the demo's situations live in the manifest, so add/remove changes the live demo.
export function addScenario(s = {}) {
  const spec = loadSpec();
  const scenario = {
    id: s.id || "s-" + Math.random().toString(36).slice(2, 7),
    title: String(s.title || "Scenario").slice(0, 60),
    premise: String(s.premise || "").slice(0, 400),
    starter: String(s.starter || "").slice(0, 300),
  };
  saveSpec({ scenarios: [...(spec.scenarios || []), scenario] });
  return scenario;
}

export function removeScenario(id) {
  const spec = loadSpec();
  saveSpec({ scenarios: (spec.scenarios || []).filter((x) => x.id !== id) });
  return loadSpec().scenarios || [];
}

export { PROFILES, FORMATS };
