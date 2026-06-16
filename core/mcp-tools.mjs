// Forge MCP tool surface — the bridge that lets Claude Code drive the harness AND feed
// VISUAL audits back into the self-improvement loop. Pure + deterministic (no stdio here);
// mcp/server.mjs wraps these in the MCP SDK. A session-scoped queue persists findings
// across tool calls so a visual audit loop accumulates within a connected session.
import { runDriver } from "./driver.mjs";
import { critique } from "./critic.mjs";
import { createQueue, enqueue, ranked, resolve } from "./queue.mjs";
import { runImprovementLoop } from "./loop.mjs";
import { readiness } from "./readiness.mjs";
import { runCopilot } from "./copilot.mjs";
import { loadSpec, saveSpec, addScenario, removeScenario, applyProfile, setFormat, PROFILES, FORMATS } from "./spec.mjs";
import { listRuns, runStats, recordRun } from "./history.mjs";
import { suggestDemos } from "./suggest.mjs";
import { seedAccounts, generateScenario } from "./seed.mjs";
import { listAudit } from "./audit.mjs";
import { recordAudit } from "./audit.mjs";
import { getBrain, trainRounds, judgeBrain, resetBrain, distill, validate } from "./brain.mjs";

const sessionQueue = createQueue();

// Routes Claude Code should screenshot (via its Playwright MCP) + the rubric to judge them.
export const VISUAL_TARGETS = {
  baseUrl: process.env.FORGE_BASE_URL || "http://localhost:5178",
  routes: ["/", "/forge", "/copilot", "/improve", "/status", "/preview"],
  rubric: [
    "visual hierarchy — is the most important thing the most prominent?",
    "contrast + legibility — text readable on background; states distinguishable",
    "spacing + alignment — consistent rhythm; nothing cramped or adrift",
    "motion — purposeful, not noisy; no distracting looping animation",
    "empty/loading states — legible while streaming",
    "cohesion — one visual language across all routes",
  ],
};

export const TOOLS = [
  { name: "demo_produce", description: "Run the agent driver to produce a demo build/run stream (live Claude Code when configured, else deterministic fallback)." },
  { name: "demo_improve", description: "Run the self-improvement loop to convergence; returns the staged trace." },
  { name: "demo_copilot", description: "Run the Live Copilot demo; returns events + outcome." },
  { name: "demo_readiness", description: "Live demo-readiness across demos." },
  { name: "demo_critique", description: "Score an artifact against requirements; returns score + gaps." },
  { name: "demo_visual_targets", description: "Routes to screenshot + the UI/UX rubric to judge them against, for a visual audit." },
  { name: "demo_record_finding", description: "Record a visual/UX finding into the improvement queue (de-duped). Args: key, label, severity, route." },
  { name: "demo_queue", description: "The current improvement queue, ranked by severity x frequency." },
  { name: "demo_resolve", description: "Mark a finding resolved after fixing it. Args: key." },
  { name: "demo_manifest", description: "Read the demo manifest (meta-config: brand, domain, scenarios, knowledge, scoring, mcp)." },
  { name: "demo_configure", description: "Update the demo manifest. Args: a partial manifest object (e.g. {meta:{brand,domain,agentName,target}}). Deep-merged + persisted." },
  { name: "demo_list_runs", description: "Demo memory — past demo runs with disposition + QA, plus aggregate stats." },
  { name: "demo_record_run", description: "Record a completed demo run into memory. Args: {title, premise, disposition, qa, action}." },
  { name: "demo_suggest_demo", description: "Intelligence layer — reason over demo memory + manifest to suggest NEW demos to run next. Args: {n}. Token-free (Claude Code)." },
  { name: "demo_list_scenarios", description: "List the demo scenarios in the manifest (what the live demo offers)." },
  { name: "demo_generate_scenario", description: "Generate a fresh realistic scenario for the current domain/brand and add it to the manifest. Token-free (Claude Code)." },
  { name: "demo_add_scenario", description: "Add a scenario to the manifest. Args: {title, premise, starter}." },
  { name: "demo_remove_scenario", description: "Remove a scenario from the manifest. Args: {id}." },
  { name: "demo_seed_environment", description: "Generate a fresh isolated sandbox seeded with realistic accounts for the current domain/brand. Args: {n}. Token-free (Claude Code)." },
  { name: "demo_list_profiles", description: "List the industry/company profiles (datasets) and the active one + available demo formats." },
  { name: "demo_switch_profile", description: "Switch the whole demo dataset to an industry/company profile (brand, domain, KB, scenarios, accounts). Args: {id}." },
  { name: "demo_set_format", description: "Select the POC form factor. Args: {format} — 'agent-assist' or 'ai-agent'." },
  { name: "demo_audit", description: "The full platform audit trail — every config edit, env change, governed action, run, suggestion and self-evolution, attributed." },
  { name: "demo_brain", description: "The self-evolving customer-service brain: the accumulated context graph (source of truth), learned policy, success history." },
  { name: "demo_train_brain", description: "Run learning rounds: simulate cases, accumulate outcome evidence into the context graph, re-derive the policy. Args: {rounds}." },
  { name: "demo_judge_brain", description: "Meta self-improvement: a judge LLM reviews the brain's context graph and proposes the optimized policy + algorithm improvements. Token-free (Claude Code)." },
  { name: "demo_reset_brain", description: "Reset the brain (clear the accumulated context graph + policy)." },
  { name: "demo_distill_brain", description: "Extract the learned decision process + algorithms into a portable artifact and DROP the seed data from the context graph (ready for live client data)." },
  { name: "demo_validate_brain", description: "Run the distilled process on a fresh, unseen sample to prove it generalizes to new data; returns success vs a random baseline. Args: {samples}." },
];

export async function callTool(name, args = {}) {
  switch (name) {
    case "demo_manifest":
      return loadSpec();
    case "demo_configure":
      recordAudit({ actor: "claude-code", action: "config.update", detail: Object.keys((args && args.meta) || args || {}).join(", ") });
      return saveSpec(args || {});
    case "demo_list_runs":
      return { runs: listRuns(args.limit || 50), stats: runStats() };
    case "demo_record_run":
      recordAudit({ actor: "claude-code", action: "demo.run", detail: `${args.title || "run"} → ${args.disposition || "—"}` });
      return recordRun(args || {});
    case "demo_suggest_demo":
      recordAudit({ actor: "claude-code", action: "suggest", detail: `requested ${args.n || 3} demo suggestions` });
      return { suggestions: await suggestDemos(args.n || 3) };
    case "demo_list_scenarios":
      return { scenarios: loadSpec().scenarios || [] };
    case "demo_generate_scenario": {
      const s = await generateScenario();
      if (s) {
        addScenario(s);
        recordAudit({ actor: "claude-code", action: "scenario.generate", detail: s.title });
      }
      return { scenario: s, scenarios: loadSpec().scenarios || [] };
    }
    case "demo_add_scenario": {
      const s = addScenario(args || {});
      recordAudit({ actor: "claude-code", action: "scenario.add", detail: s.title });
      return { scenario: s, scenarios: loadSpec().scenarios || [] };
    }
    case "demo_remove_scenario":
      recordAudit({ actor: "claude-code", action: "scenario.remove", detail: String(args.id || "") });
      return { scenarios: removeScenario(args.id) };
    case "demo_seed_environment": {
      const accounts = await seedAccounts(args.n || 3);
      const id = "env-" + Math.random().toString(36).slice(2, 6);
      const environment = { id, label: "Claude-generated · " + id, baseline: false, accounts };
      saveSpec({ environment });
      recordAudit({ actor: "claude-code", action: "env.generate", detail: `${id} · ${accounts.length} accounts` });
      return environment;
    }
    case "demo_list_profiles":
      return { profiles: PROFILES.map((p) => ({ id: p.id, label: p.label, brand: p.meta.brand, domain: p.meta.domain })), formats: FORMATS, active: loadSpec().profile, format: loadSpec().format };
    case "demo_switch_profile": {
      const spec = applyProfile(args.id);
      recordAudit({ actor: "claude-code", action: "profile.switch", detail: `${spec.profile} · ${spec.meta.brand}` });
      return { profile: spec.profile, brand: spec.meta.brand, domain: spec.meta.domain, scenarios: spec.scenarios };
    }
    case "demo_set_format": {
      const spec = setFormat(args.format);
      recordAudit({ actor: "claude-code", action: "format.set", detail: spec.format });
      return { format: spec.format };
    }
    case "demo_audit":
      return { entries: listAudit(args.limit || 80) };
    case "demo_brain":
      return getBrain();
    case "demo_train_brain":
      recordAudit({ actor: "claude-code", action: "brain.train", detail: `${args.rounds || 8} rounds` });
      return trainRounds(args.rounds || 8, args.casesPerRound || 40);
    case "demo_judge_brain": {
      const j = await judgeBrain();
      recordAudit({ actor: "claude-code", action: "brain.judge", detail: `success ${j.before}% → ${j.after}%` });
      return j;
    }
    case "demo_reset_brain":
      recordAudit({ actor: "claude-code", action: "brain.reset", detail: "context graph + policy cleared" });
      return resetBrain();
    case "demo_distill_brain": {
      const artifact = distill();
      recordAudit({ actor: "claude-code", action: "brain.distill", detail: `v${artifact.version} · process extracted, seed data dropped` });
      return artifact;
    }
    case "demo_validate_brain": {
      const result = validate(args.samples || 500);
      recordAudit({ actor: "claude-code", action: "brain.validate", detail: `${result.success ?? 0}% vs ${result.baseline ?? 0}% baseline on unseen data` });
      return result;
    }
    case "demo_produce":
      return { events: runDriver({ name: args.name || "demo" }) };
    case "demo_improve":
      return runImprovementLoop();
    case "demo_copilot":
      return runCopilot();
    case "demo_readiness":
      return readiness();
    case "demo_critique":
      return critique(args.requirements || [], args.present || {});
    case "demo_visual_targets":
      return VISUAL_TARGETS;
    case "demo_record_finding": {
      const added = enqueue(sessionQueue, {
        key: args.key || `finding-${sessionQueue.items.length + 1}`,
        label: args.label || "(visual finding)",
        severity: args.severity || "med",
        source: args.source || "visual",
        route: args.route || null,
      });
      return { added, queue: ranked(sessionQueue) };
    }
    case "demo_queue":
      return { queue: ranked(sessionQueue) };
    case "demo_resolve":
      return { resolved: resolve(sessionQueue, args.key), queue: ranked(sessionQueue) };
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

export { sessionQueue };
