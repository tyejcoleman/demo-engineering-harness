"use client";

import { useEffect, useRef, useState } from "react";
import { ContextGraph, type Graph } from "@/components/ContextGraph";

// The Harness Control Plane: a clean, client-facing operator console for the demo platform —
// meta-configuration, an isolated sandbox environment, an intelligence layer that learns from demo
// memory, and a Claude-Code-driven (token-free) self-evolution loop. Engine badges make the
// hybrid honest: the demo runtime is fast (Gemini); the platform's brain is token-free Claude Code.

type Spec = {
  meta: { name: string; brand: string; domain: string; agentName: string; target: number };
  scenarios: { id: string; title: string }[];
  knowledge: { id: string; title: string; text: string }[];
  personas: Record<string, string>;
  scoring: { target: number; rubric: string[] };
  mcp: { id: string; kind: string; name: string; status?: string; tools?: string[] }[];
};
type Ready = { id: string; name: string; tag: string; pct: number; passed: number; total: number; ready: boolean };
type Harness = { provider: string; claude: boolean; mcp: Spec["mcp"]; target: number; readiness: Ready[] };
type CrmAcct = { id: string; name: string; plan: string; mrr: number; status: string; ltv: number; riskScore: number; region: string };
type Env = { id: string; label: string; baseline: boolean; accounts: { name: string; plan: string; mrr: number }[]; sources: { kind: string; name: string; status: string; count: number }[]; crm?: CrmAcct[]; crmStats?: { total: number; vip: number; atRisk: number; avgLtv: number; openTickets: number } };
type Run = { id: string; title: string; disposition: string; qa: number; at: string };
type Stats = { total: number; byDisposition: Record<string, number>; avgQa: number };
type Suggestion = { title: string; premise: string; starter: string; why: string };
type Loadable = { title: string; premise: string; starter: string; rationale?: string };

const SUBS: [string, string][] = [
  ["learn", "Self-learning"],
  ["crm", "CRM"],
  ["mcp", "MCP"],
];

type Brain = {
  graph: Graph;
  policy: Record<string, string>;
  history: { round: number; success: number; judge?: boolean }[];
  judge: { rationale: string; improvements: string[]; changed?: { concern: string; from: string; to: string }[]; before: number; after: number } | null;
  success: number;
  stage?: string;
  distilled?: { version: number; rules: { concern: string; strategy: string; confidence: number | null }[]; trainedSuccess: number; note: string } | null;
  validation?: { success: number; baseline: number; samples: number; trainedSuccess: number; perConcern: { concern: string; strategy: string; success: number }[] } | null;
};

// Copy-paste onboarding for ANY developer's Claude Code to connect over MCP (token-free).
const ONBOARDING = `# Connect your Claude Code to the Forge demo platform (MCP)

# 1) Register the harness MCP server (from the project root):
claude mcp add forge -- node mcp/server.mjs
#    …or add to .mcp.json:
#    { "mcpServers": { "forge": { "command": "node", "args": ["mcp/server.mjs"] } } }

# 2) Paste this to your Claude Code — one MCP, the whole platform:
You're connected to the "forge" demo platform over MCP. You can manage everything from here:
• Config: forge_manifest (read) / forge_configure (edit brand, domain, agent, target)
• Profiles & formats: forge_list_profiles / forge_switch_profile (swap the whole industry dataset) / forge_set_format (agent-assist | ai-agent)
• Scenarios: forge_list_scenarios / forge_generate_scenario / forge_add_scenario / forge_remove_scenario
• Data: forge_seed_environment (mint realistic accounts for the domain)
• Demos & memory: forge_list_runs / forge_record_run / forge_suggest_demo
• Self-evolution: forge_critique / forge_improve / forge_readiness (drive until readiness hits target)
• Audit: forge_audit (everything you change is attributed and logged)
Start by reading forge_manifest and forge_list_runs, then propose and run the next best demo.`;
const dispTone = (d: string) => (d === "Saved" || d === "Resolved" ? "text-good border-good/40 bg-good/5" : d === "Lost" ? "text-bad border-bad/40 bg-bad/5" : "text-warn border-warn/40 bg-warn/5");

function EngineBadge({ kind }: { kind: "claude" | "gemini" }) {
  return kind === "claude" ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/5 px-2 py-0.5 text-[10px] font-medium text-accent">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Claude Code
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-accent2/40 bg-accent2/5 px-2 py-0.5 text-[10px] font-medium text-accent2">
      <span className="h-1.5 w-1.5 rounded-full bg-accent2" /> Gemini
    </span>
  );
}

export function Platform({ onLoad, tab }: { onLoad?: (s: Loadable) => void; tab?: string }) {
  const [subState, setSub] = useState("learn");
  const sub = tab || subState;
  const [spec, setSpec] = useState<Spec | null>(null);
  const [harness, setHarness] = useState<Harness | null>(null);
  const [env, setEnv] = useState<Env | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [audit, setAudit] = useState<{ id: string; at: string; actor: string; action: string; detail: string }[]>([]);
  const [brain, setBrain] = useState<Brain | null>(null);
  const [feedback, setFeedback] = useState<{ count: number; avgScore: number; satisfiedPct: number; recent: { score: number; satisfied: boolean; concern?: string; critique?: string; improvement?: string }[]; improvements: string[] } | null>(null);
  const [training, setTraining] = useState(false);
  const [bPaused, setBPaused] = useState(false);
  const [bSpeed, setBSpeed] = useState(550);
  const [liveCurve, setLiveCurve] = useState<{ round: number; success: number; judge?: boolean }[]>([]);
  const [coldBaseline, setColdBaseline] = useState<number | null>(null); // fresh pre-training baseline
  const brainEsRef = useRef<EventSource | null>(null);
  const bBufRef = useRef<{ kind: string; round?: number; success?: number }[]>([]);
  const bPausedRef = useRef(false);

  const [brand, setBrand] = useState("");
  const [domain, setDomain] = useState("");
  const [agentName, setAgentName] = useState("");
  const [target, setTarget] = useState(90);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);

  const esRef = useRef<EventSource | null>(null);

  const loadSpec = async () => {
    const s: Spec = await (await fetch("/api/manifest", { cache: "no-store" })).json();
    setSpec(s);
    setBrand(s.meta.brand);
    setDomain(s.meta.domain);
    setAgentName(s.meta.agentName);
    setTarget(s.meta.target);
  };
  const loadHarness = async () => setHarness(await (await fetch("/api/harness", { cache: "no-store" })).json());
  const loadEnv = async () => setEnv(await (await fetch("/api/env", { cache: "no-store" })).json());
  const loadHistory = async () => {
    const h = await (await fetch("/api/history", { cache: "no-store" })).json();
    setRuns(h.runs || []);
    setStats(h.stats || null);
  };
  const loadAudit = async () => setAudit((await (await fetch("/api/audit", { cache: "no-store" })).json()).entries || []);
  const loadBrain = async () => setBrain(await (await fetch("/api/brain", { cache: "no-store" })).json());
  const loadFeedback = async () => setFeedback(await (await fetch("/api/feedback", { cache: "no-store" })).json());
  // Train the brain — round events are buffered and revealed under a pause/speed control so the
  // learning curve builds visibly, exactly like the live demo. The training itself is real.
  const trainBrain = () => {
    brainEsRef.current?.close();
    setTraining(true);
    setLiveCurve([]);
    setColdBaseline(null);
    bBufRef.current = [];
    bPausedRef.current = false;
    setBPaused(false);
    const es = new EventSource(`/api/brain/train?rounds=12&t=${Date.now()}`);
    brainEsRef.current = es;
    es.addEventListener("baseline", (e) => setColdBaseline(JSON.parse((e as MessageEvent).data).success));
    es.addEventListener("round", (e) => bBufRef.current.push({ kind: "round", ...JSON.parse((e as MessageEvent).data) }));
    es.addEventListener("judge", () => bBufRef.current.push({ kind: "judge" }));
    es.addEventListener("done", () => bBufRef.current.push({ kind: "done" }));
    es.onerror = () => { setTraining(false); es.close(); };
  };
  const toggleBrainPause = () => { const np = !bPausedRef.current; bPausedRef.current = np; setBPaused(np); };
  const stepBrain = () => {
    const ev = bBufRef.current.shift();
    if (!ev) return;
    if (ev.kind === "round") { setLiveCurve((c) => [...c, { round: ev.round as number, success: ev.success as number }]); loadBrain(); }
    else { loadBrain(); loadAudit(); if (ev.kind === "done") setTraining(false); }
  };
  useEffect(() => {
    const id = setInterval(() => {
      if (bPausedRef.current || !bBufRef.current.length) return;
      const ev = bBufRef.current.shift()!;
      if (ev.kind === "round") { setLiveCurve((c) => [...c, { round: ev.round as number, success: ev.success as number }]); loadBrain(); }
      else { loadBrain(); loadAudit(); if (ev.kind === "done") setTraining(false); }
    }, bSpeed);
    return () => clearInterval(id);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [bSpeed]);
  const resetBrainState = async () => {
    brainEsRef.current?.close();
    bBufRef.current = [];
    setLiveCurve([]);
    setColdBaseline(null);
    setTraining(false);
    await fetch("/api/brain", { method: "DELETE" });
    loadBrain();
    loadAudit();
  };
  const distillBrain = async () => {
    await fetch("/api/brain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "distill" }) });
    loadBrain();
    loadAudit();
  };
  const [validating, setValidating] = useState(false);
  const [valProgress, setValProgress] = useState<{ done: number; total: number; success: number; baseline: number } | null>(null);
  const valEsRef = useRef<EventSource | null>(null);
  // Stream the generalization test: real Monte-Carlo batches revealed live so the rate climbs and the
  // context graph refills — proving it's computed on unseen data, not an instant hardcoded number.
  const validateBrain = () => {
    valEsRef.current?.close();
    setValidating(true);
    setValProgress(null);
    const es = new EventSource("/api/brain/validate?samples=600");
    valEsRef.current = es;
    es.addEventListener("batch", (e) => {
      setValProgress(JSON.parse((e as MessageEvent).data));
      loadBrain(); // refill the context graph with the new test data, batch by batch
    });
    es.addEventListener("result", () => {
      loadBrain();
      loadAudit();
    });
    const stop = () => {
      setValidating(false);
      es.close();
      loadBrain();
    };
    es.addEventListener("done", stop);
    es.onerror = stop;
  };

  useEffect(() => {
    loadSpec();
    loadHarness();
    loadEnv();
    loadHistory();
    loadAudit();
    loadBrain();
    loadFeedback();
    return () => {
      esRef.current?.close();
      brainEsRef.current?.close();
    };
  }, []);

  const saveManifest = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/manifest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ meta: { brand, domain, agentName, target } }) });
      await loadSpec();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };
  const resetManifest = async () => {
    await fetch("/api/manifest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ __reset: true }) });
    await loadSpec();
  };
  const [scenBusy, setScenBusy] = useState(false);
  const scenGenerate = async () => {
    setScenBusy(true);
    try {
      await fetch("/api/scenarios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "generate" }) });
      await loadSpec();
      loadAudit();
    } finally {
      setScenBusy(false);
    }
  };
  const scenRemove = async (id: string) => {
    await fetch(`/api/scenarios?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadSpec();
    loadAudit();
  };

  const suggest = async () => {
    setSuggesting(true);
    try {
      const r = await (await fetch(`/api/suggest?n=3&t=${Date.now()}`, { cache: "no-store" })).json();
      setSuggestions(r.suggestions || []);
    } finally {
      setSuggesting(false);
    }
  };

  const tools = harness?.mcp?.find((m) => m.id === "claude-code")?.tools || [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* sub-tabs (hidden when the page drives the tab) */}
      {!tab && (
        <div className="flex flex-wrap gap-2">
          {SUBS.map(([id, label]) => (
            <button key={id} onClick={() => setSub(id)} className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${sub === id ? "bg-accent/10 text-accent ring-1 ring-accent/30" : "bg-panel2 text-muted hover:text-fg"}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── META-CONFIG (retired — manifest editing lives via MCP tools, not a UI panel) ── */}
      {sub === "__off" && spec && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <section className="card p-5 lg:col-span-5">
            <div className="label">Demo manifest · the editable source of truth</div>
            <div className="mt-4 space-y-3.5">
              {([["Brand", brand, setBrand, "Acme Telecom"], ["Domain", domain, setDomain, "telecom contact-center"], ["Agent name", agentName, setAgentName, "Maya"]] as [string, string, (v: string) => void, string][]).map(([label, val, setter, ph]) => (
                <label key={label} className="block">
                  <span className="text-xs text-muted">{label}</span>
                  <input value={val} onChange={(e) => setter(e.target.value)} placeholder={ph} className="input mt-1" />
                </label>
              ))}
              <label className="block">
                <span className="text-xs text-muted">Readiness / self-evolution target — {target}%</span>
                <input type="range" min={70} max={100} value={target} onChange={(e) => setTarget(Number(e.target.value))} className="mt-2 w-full accent-[#6d4bff]" />
              </label>
              <div className="flex items-center gap-2 pt-1">
                <button onClick={saveManifest} disabled={saving} className="btn-primary">{saving ? "applying…" : "Apply to live demo"}</button>
                <button onClick={resetManifest} className="btn-ghost">Reset</button>
                {saved && <span className="text-xs text-good">✓ applied</span>}
              </div>
              <p className="text-[11px] leading-relaxed text-muted">Not decorative — brand / domain / agent name flow straight into the live agent prompts. Switch the domain to another industry and the whole scenario regenerates.</p>
            </div>
          </section>
          <section className="card p-5 lg:col-span-7">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="label">Scenarios · {spec.scenarios.length}</div>
                  <button onClick={scenGenerate} disabled={scenBusy} className="rounded-md border border-accent2/40 bg-accent2/5 px-2 py-0.5 text-[10px] font-medium text-accent2 transition hover:border-accent2 disabled:opacity-50">{scenBusy ? "generating…" : "Generate (Claude Code)"}</button>
                </div>
                <div className="mt-2 space-y-1.5">
                  {spec.scenarios.map((s) => (
                    <div key={s.id} className="card-inset flex items-center gap-2 px-2.5 py-1.5 text-xs text-fg">
                      <span className="min-w-0 flex-1 truncate">{s.title}</span>
                      <button onClick={() => scenRemove(s.id)} className="shrink-0 text-muted transition hover:text-bad" title="remove scenario">✕</button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="label">Knowledge base · {spec.knowledge.length}</div>
                <div className="mt-2 space-y-1.5">{spec.knowledge.map((k) => <div key={k.id} className="card-inset px-2.5 py-1.5 text-xs"><span className="font-medium text-accent">{k.id}</span> <span className="text-muted">— {k.title}</span></div>)}</div>
              </div>
            </div>
            <div className="mt-5">
              <div className="label">Scoring rubric · target {spec.scoring.target}%</div>
              <div className="mt-2 flex flex-wrap gap-1.5">{spec.scoring.rubric.map((r) => <span key={r} className="chip">{r}</span>)}</div>
            </div>
            <div className="mt-5">
              <div className="label">Agent personas</div>
              <div className="mt-2 space-y-1.5">{Object.entries(spec.personas).map(([k, v]) => <div key={k} className="text-[11px]"><span className="font-medium text-accent">{k}</span> <span className="text-muted">— {v}</span></div>)}</div>
            </div>
          </section>
        </div>
      )}

      {/* ── ENVIRONMENT ── */}
      {sub === "crm" && env && (
        <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-12">
          <section className="card flex min-h-0 flex-col overflow-y-auto p-5 lg:col-span-7">
            <div className="flex items-center justify-between">
              <div className="label">Sandbox environment</div>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] ${env.baseline ? "border border-edge bg-panel2 text-muted" : "border border-good/40 bg-good/5 text-good"}`}>{env.label}</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {env.sources.map((s) => (
                <div key={s.name} className="card-inset p-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-fg"><span className={`h-2 w-2 rounded-full ${s.status === "wired" ? "bg-accent" : "bg-accent2"}`} /> {s.name}</div>
                  <div className="mt-1 text-[11px] text-muted">{s.kind} · {s.status}</div>
                  <div className="mt-2 text-2xl font-semibold tabular-nums text-fg">{s.count}</div>
                  <div className="text-[10px] text-muted">{s.kind === "mcp" ? "tools" : s.kind === "kb" ? "policies" : "accounts"}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted">The simulated CRM is the source of truth the live agent reads from — an isolated, clean-room book of business per industry. In production this is your Salesforce / Zendesk / contact-center.</p>
            {spec?.knowledge?.length ? (
              <div className="mt-4 min-h-0 flex-1">
                <div className="label">Knowledge base · {spec.knowledge.length} grounding policies</div>
                <div className="mt-2 space-y-1.5">
                  {spec.knowledge.map((k) => (
                    <div key={k.id} className="card-inset px-2.5 py-1.5 text-[11px] leading-relaxed"><span className="font-medium text-accent2">{k.id}</span> <span className="text-fg/80">— {k.text}</span></div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
          <section className="card flex min-h-0 flex-col p-5 lg:col-span-5">
            <div className="flex items-center justify-between gap-2">
              <div className="label">Simulated CRM · source of truth</div>
              <span className="text-[10px] text-muted">prod: Salesforce / Zendesk / contact-center</span>
            </div>
            {env.crmStats && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="chip">{env.crmStats.total} accounts</span>
                <span className="chip">{env.crmStats.vip} VIP</span>
                <span className="chip !text-bad !border-bad/40">{env.crmStats.atRisk} at-risk</span>
                <span className="chip">avg LTV ${env.crmStats.avgLtv.toLocaleString()}</span>
                <span className="chip">{env.crmStats.openTickets} open tickets</span>
              </div>
            )}
            <div className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto">
              {(env.crm || []).map((a) => (
                <div key={a.id} className="card-inset flex items-center gap-2 px-2.5 py-1.5 text-xs">
                  <span className="w-24 shrink-0 truncate font-medium text-fg">{a.name}</span>
                  <span className="hidden w-20 shrink-0 truncate text-muted sm:inline">{a.plan}</span>
                  <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] ${a.status === "at_risk" ? "border-bad/40 text-bad" : a.status === "vip" ? "border-accent/40 text-accent" : "border-edge text-muted"}`}>{a.status === "at_risk" ? "at-risk" : a.status}</span>
                  <span className="ml-auto shrink-0 tabular-nums text-muted">${a.mrr}/mo</span>
                  <span className="shrink-0 tabular-nums text-muted">LTV ${(a.ltv / 1000).toFixed(1)}k</span>
                  <span className={`shrink-0 tabular-nums ${a.riskScore >= 55 ? "text-bad" : "text-muted"}`}>r{a.riskScore}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ── INTELLIGENCE ── */}
      {sub === "__off" && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <section className="card p-5 lg:col-span-5">
            <div className="flex items-center justify-between">
              <div className="label">Demo memory · {stats?.total ?? 0} runs</div>
              <div className="flex flex-wrap gap-1.5">{stats && Object.entries(stats.byDisposition).map(([d, c]) => <span key={d} className={`rounded-full border px-2 py-0.5 text-[10px] ${dispTone(d)}`}>{d} {c}</span>)}</div>
            </div>
            <div className="mt-3 max-h-[40vh] space-y-1.5 overflow-y-auto">
              {runs.length === 0 && <div className="text-xs text-muted">Run a few demos — each is recorded here as context the intelligence layer reasons over.</div>}
              {runs.map((r) => (
                <div key={r.id} className="card-inset flex items-center gap-2 px-2.5 py-1.5 text-xs">
                  <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] ${dispTone(r.disposition)}`}>{r.disposition}</span>
                  <span className="flex-1 truncate text-fg">{r.title}</span>
                  <span className="shrink-0 text-muted">QA {r.qa}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="card p-5 lg:col-span-7">
            <div className="flex items-center justify-between gap-2">
              <div className="label">Intelligence layer · suggests demos from memory</div>
              <button onClick={suggest} disabled={suggesting} className="btn-ghost !border-accent2/50 text-accent2">{suggesting ? "reasoning…" : "Suggest next demos"}</button>
            </div>
            <div className="mt-1.5"><EngineBadge kind="claude" /> <span className="text-[11px] text-muted">reasons over the demo memory</span></div>
            <div className="mt-3 space-y-2">
              {suggestions.length === 0 && !suggesting && <div className="text-xs text-muted">It reads what's already been demonstrated and proposes new scenarios that cover the gaps — then you load one straight into the live demo.</div>}
              {suggestions.map((s, i) => (
                <div key={i} className="fadeup card-inset p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-fg">{s.title}</div>
                    {onLoad && <button onClick={() => onLoad({ title: s.title, premise: s.premise, starter: s.starter, rationale: s.why })} className="shrink-0 rounded-md border border-accent/40 bg-accent/5 px-2.5 py-1 text-[11px] font-medium text-accent transition hover:bg-accent/10">Load into demo →</button>}
                  </div>
                  <div className="mt-1 text-xs text-fg/80">{s.premise}</div>
                  {s.why && <div className="mt-1.5 text-[11px] text-accent">covers · {s.why}</div>}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ── BRAIN (self-evolving context graph + judge LLM) ── */}
      {sub === "learn" && (
        <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-12">
          <section className="card flex min-h-0 flex-col overflow-hidden lg:col-span-6">
            <div className="flex shrink-0 items-center justify-between border-b border-edge bg-panel2 px-4 py-2 label">
              <span>Brain · context graph = source of truth</span>
              <span className="text-muted">{brain?.graph?.nodes?.length || 0} nodes · success {brain?.success || 0}%</span>
            </div>
            <div className="relative min-h-0 flex-1">
              {brain && brain.graph?.nodes?.length ? (
                <ContextGraph graph={brain.graph} />
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">Train the brain — the context graph accumulates outcome evidence here (concern → strategy → outcome), weighted by what actually works. It is the memory, the audit trail, and the context the AI reasons over.</div>
              )}
            </div>
          </section>
          <section className="card flex min-h-0 flex-col overflow-y-auto p-5 lg:col-span-6">
            <div className="flex items-center justify-between gap-2">
              <div className="label">Meta self-improvement · graph → judge LLM</div>
              <div className="flex flex-wrap items-center gap-2">
                {training && (
                  <>
                    <button onClick={toggleBrainPause} className="btn-ghost !px-2.5 !py-1 !text-xs">{bPaused ? "Play" : "Pause"}</button>
                    <button onClick={stepBrain} className="btn-ghost !px-2.5 !py-1 !text-xs">Step</button>
                  </>
                )}
                <span className="flex items-center gap-1 text-[10px] text-muted">Speed<input type="range" min={150} max={1200} step={50} value={1350 - bSpeed} onChange={(e) => setBSpeed(1350 - Number(e.target.value))} className="w-16 accent-[#6d4bff]" /></span>
                <button onClick={trainBrain} disabled={training} className="btn-primary">{training ? "● learning…" : "Train brain"}</button>
                <button onClick={resetBrainState} className="btn-ghost">Reset</button>
              </div>
            </div>
            <div className="mt-1.5 text-[11px] text-muted">The judge is a second LLM that reviews the accumulated graph and refines the decision policy.</div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
              {["Try strategies, record outcomes in the graph", "Learn the best response per concern", "Judge LLM refines the policy", "Distill → test on unseen data"].map((t, i) => (
                <span key={i} className="rounded-full border border-edge bg-panel px-2 py-0.5 text-muted"><b className="text-accent">{i + 1}</b> {t}</span>
              ))}
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <div className="label">Customer-success rate · learning curve</div>
                {(() => {
                  const h = liveCurve.length ? liveCurve : brain?.history || [];
                  const cold = coldBaseline ?? (h.length ? h[0].success : null);
                  if (cold == null || !h.length) return null;
                  const j = brain?.judge;
                  if (j) return <span className="text-[11px] text-muted">untrained <b className="text-bad">{cold}%</b> → trained <b className="text-fg">{j.before}%</b> → optimized <b className="text-good">{j.after}%</b> <span className="text-good">(+{Math.max(0, j.after - cold)})</span></span>;
                  const now = brain?.success || h[h.length - 1].success;
                  return <span className="text-[11px] text-muted">untrained <b className="text-bad">{cold}%</b> → now <b className="text-good">{now}%</b></span>;
                })()}
              </div>
              <div className="mt-2 rounded-lg border border-edge bg-panel2 p-2">
                {(() => {
                  const data = (liveCurve.length ? liveCurve : brain?.history || []).slice(-40);
                  if (!data.length) return <div className="flex h-24 items-center justify-center text-xs text-muted">no rounds yet — press Train brain</div>;
                  const n = data.length;
                  const pts = data.map((h, i) => [n === 1 ? 0 : (i / (n - 1)) * 100, 100 - Math.max(2, Math.min(100, h.success))] as const);
                  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
                  const last = pts[pts.length - 1];
                  return (
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-24 w-full">
                      <defs><linearGradient id="lc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6d4bff" stopOpacity="0.28" /><stop offset="100%" stopColor="#6d4bff" stopOpacity="0" /></linearGradient></defs>
                      <line x1="0" y1="50" x2="100" y2="50" stroke="#e4e9f2" strokeWidth="0.5" />
                      <path d={`${line} L100 100 L0 100 Z`} fill="url(#lc)" />
                      <path d={line} fill="none" stroke="#6d4bff" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                      <circle cx={last[0]} cy={last[1]} r="2" fill="#6d4bff" vectorEffect="non-scaling-stroke" />
                    </svg>
                  );
                })()}
              </div>
              <div className="mt-1 text-right text-[10px] text-muted">untrained = no policy · trained = online learning · optimized = after the judge&apos;s offline correction</div>
            </div>

            <div className="mt-4">
              <div className="label">Learned policy · concern → best strategy</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(brain?.policy || {}).map(([c, s]) => (
                  <span key={c} className="chip">{c} → <b className="ml-1 text-accent">{s as string}</b></span>
                ))}
                {!brain || !Object.keys(brain.policy || {}).length ? <span className="text-xs text-muted">learned from the graph after training</span> : null}
              </div>
            </div>

            {brain?.judge && (
              <div className="card-inset mt-4 p-3">
                <div className="flex items-center justify-between"><div className="label">Judge LLM · meta-review</div>{brain.judge.after > brain.judge.before ? <span className="text-xs font-medium text-good">corrected: trained {brain.judge.before}% → optimized {brain.judge.after}%</span> : <span className="text-xs text-muted">✓ validated · already optimal at {brain.judge.after}%</span>}</div>
                <p className="mt-1.5 text-xs leading-relaxed text-fg/85">{brain.judge.rationale}</p>
                {brain.judge.changed && brain.judge.changed.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {brain.judge.changed.map((ch, i) => (
                      <span key={i} className="chip !text-[10px]"><span className="text-muted">{ch.concern}</span> {ch.from} <span className="text-good">→ {ch.to}</span></span>
                    ))}
                  </div>
                )}
                {brain.judge.improvements?.length > 0 && (
                  <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[11px] text-muted">
                    {brain.judge.improvements.map((x, i) => <li key={i}>{x}</li>)}
                  </ul>
                )}
              </div>
            )}

            {/* LOOP 2 — active feedback from live calls, judged by a blind CX evaluator */}
            <div className="card-inset mt-4 border border-accent2/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="label">Active-feedback loop · from live calls</div>
                {feedback && feedback.count > 0 ? (
                  <span className="text-xs text-fg">CX <b className={feedback.avgScore >= 70 ? "text-good" : "text-warn"}>{feedback.avgScore}%</b> · {feedback.satisfiedPct}% satisfied · {feedback.count} calls</span>
                ) : (
                  <span className="text-[11px] text-muted">run live calls to populate</span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-muted">A 2nd self-improvement path: an <b className="text-fg">independent CX judge</b> — blind to the demo — scores every live call on genuine customer satisfaction and proposes concrete fixes to the agent&apos;s knowledge/policy. Learns from real interactions, not simulated training.</p>
              {feedback && feedback.improvements.length > 0 && (
                <div className="mt-2">
                  <div className="label !text-[10px]">improvements proposed from real calls</div>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-fg/85">
                    {feedback.improvements.slice(0, 4).map((x, i) => <li key={i}>{x}</li>)}
                  </ul>
                </div>
              )}
            </div>

            {/* ② Distill — extract the process, drop the seed data */}
            <div className="card-inset mt-4 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="label">② Distill → portable process (drop seed data)</div>
                <button onClick={distillBrain} disabled={!brain?.history?.length} className="rounded-md border border-accent/40 bg-accent/5 px-2.5 py-1 text-[11px] font-medium text-accent transition hover:bg-accent/10 disabled:opacity-40">Distill</button>
              </div>
              {brain?.distilled ? (
                <>
                  <p className="mt-1.5 text-[11px] text-good">✓ extracted v{brain.distilled.version} — {brain.distilled.rules.length} rules, no training data attached. Seed data dropped from the graph.</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {brain.distilled.rules.map((r) => (
                      <span key={r.concern} className="chip">{r.concern} → <b className="ml-1 text-accent">{r.strategy}</b>{r.confidence != null ? <span className="ml-1 text-muted">{r.confidence}%</span> : null}</span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="mt-1 text-[11px] text-muted">Extract the learned policy + algorithms; the seed data points drop out of the context graph — what remains is the portable brain you point at live client data.</p>
              )}
            </div>

            {/* ③ Test on new data — generalization proof */}
            <div className="card-inset mt-3 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="label">③ Test on new data</div>
                <button onClick={validateBrain} disabled={!brain?.history?.length || validating} className="rounded-md border border-accent/40 bg-accent/5 px-2.5 py-1 text-[11px] font-medium text-accent transition hover:bg-accent/10 disabled:opacity-40">{validating ? "testing…" : "Test on new data"}</button>
              </div>
              {validating && valProgress ? (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[11px]"><span className="text-muted">testing on unseen cases…</span><span className="tabular-nums text-fg">{valProgress.done}/{valProgress.total}</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-edge"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round((100 * valProgress.done) / valProgress.total)}%` }} /></div>
                  <div className="mt-1.5 text-[11px] text-fg">running <b className="text-good">{valProgress.success}%</b> vs <span className="text-muted">{valProgress.baseline}% untrained</span> — graph refilling with live data</div>
                </div>
              ) : brain?.validation ? (
                <div className="mt-2">
                  <div className="flex items-end gap-5">
                    <div><div className="text-2xl font-semibold text-good">{brain.validation.success}%</div><div className="text-[10px] text-muted">{brain?.distilled ? "distilled" : "trained"} · {brain.validation.samples} unseen</div></div>
                    <div><div className="text-lg font-semibold text-muted">{brain.validation.baseline}%</div><div className="text-[10px] text-muted">untrained baseline</div></div>
                    <div><div className="text-lg font-semibold text-fg/60">{brain.validation.trainedSuccess}%</div><div className="text-[10px] text-muted">on training set</div></div>
                  </div>
                  <p className="mt-2 text-[11px] text-muted">Generalizes to data it never saw — far above the untrained baseline — proving real learned value, not memorized scenarios. Test after training and again after Distill to compare each stage.</p>
                </div>
              ) : (
                <p className="mt-1 text-[11px] text-muted">Run the policy on a fresh, unseen sample vs an untrained baseline. Works after training — then Distill and re-test to compare pre-trained → trained → distilled quality.</p>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ── MCP connection + topology + onboarding ── */}
      {sub === "mcp" && (
        <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          <section className="card overflow-hidden">
            <div className="label px-4 pt-3">Live topology · Claude Code over MCP</div>
            <Topology mcpTools={tools.length} envLabel={env?.label} demos={stats?.total ?? 0} />
          </section>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <section className="card p-5 lg:col-span-5">
            <div className="label">Claude Code · MCP connection</div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className={`h-2.5 w-2.5 rounded-full ${harness?.claude ? "bg-good" : "bg-bad"}`} />
              <span className="font-medium text-fg">{harness?.claude ? "connected" : "not detected"}</span>
              <EngineBadge kind="claude" />
            </div>
            {tools.length > 0 && (
              <div className="mt-3">
                <div className="label">exposed tools · {tools.length}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">{tools.map((t) => <span key={t} className="rounded-md border border-accent/30 bg-accent/5 px-2 py-0.5 font-mono text-[10px] text-accent">{t}</span>)}</div>
              </div>
            )}
            <div className="card-inset mt-4 p-3">
              <div className="label">Onboarding — connect any Claude Code</div>
              <p className="mb-2 mt-1 text-[11px] text-muted">Copy this into any developer&apos;s Claude Code to connect over MCP and drive the platform — every change audited.</p>
              <CopyBlock text={ONBOARDING} />
            </div>
          </section>
          <section className="card p-5 lg:col-span-7">
            <div className="label">What you can do via MCP</div>
            <p className="mt-1 text-[11px] text-muted">Connect any Claude Code (left) and drive the whole platform with these tools — manage data &amp; scenarios, run demos, and run the self-learning loop. Everything is attributed in the audit trail below.</p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                ["Manage the demo", "forge_manifest · forge_configure"],
                ["Switch industry / format", "forge_switch_profile · forge_set_format"],
                ["Manage data (CRM)", "forge_seed_environment · forge_list_runs"],
                ["Create scenarios", "forge_generate_scenario · forge_add_scenario"],
                ["Self-learning over the graph", "forge_train_brain · forge_judge_brain · forge_distill_brain"],
                ["Improve / verify", "forge_critique · forge_improve · forge_readiness · forge_validate_brain"],
              ].map(([t, tools]) => (
                <div key={t} className="card-inset p-2.5">
                  <div className="text-xs font-medium text-fg">{t}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-accent">{tools}</div>
                </div>
              ))}
            </div>
          </section>
          </div>
        </div>
      )}

      {/* ── AUDIT ── */}
      {sub === "mcp" && (
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <div className="label">Full audit trail · {audit.length} events</div>
              <span className="text-[11px] text-muted">every config edit, environment change, governed action, run, suggestion & self-evolution — attributed</span>
            </div>
            <div className="mt-3 max-h-[60vh] space-y-1 overflow-y-auto">
              {audit.length === 0 && <div className="text-xs text-muted">No activity yet. Run a demo, edit the config, or self-evolve — every change is logged here.</div>}
              {audit.map((a) => (
                <div key={a.id} className="card-inset flex items-center gap-3 px-3 py-1.5 text-xs">
                  <span className="shrink-0 font-mono text-[10px] text-muted">{a.at.slice(5, 16).replace("T", " ")}</span>
                  <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] ${a.actor === "claude-code" ? "border-good/40 bg-good/5 text-good" : a.actor === "agent" ? "border-accent/40 bg-accent/5 text-accent" : "border-edge bg-panel2 text-muted"}`}>{a.actor}</span>
                  <span className="shrink-0 font-mono text-[11px] text-accent2">{a.action}</span>
                  <span className="min-w-0 flex-1 truncate text-fg/80">{a.detail}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-[#0f1422] p-3 pr-16 font-mono text-[10px] leading-relaxed text-[#cfd8ee]">{text}</pre>
      <button
        onClick={() => { try { navigator.clipboard?.writeText(text); } catch {} setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="absolute right-2 top-2 rounded-md border border-white/15 bg-white/10 px-2 py-1 text-[10px] text-[#cfd8ee] transition hover:bg-white/20"
      >
        {copied ? "copied ✓" : "copy"}
      </button>
    </div>
  );
}

// Live topology of the running platform — light variant. Claude Code → MCP → harness → surfaces,
// with connectors that visibly stream (flowing dashes) so the system reads as alive.
export function Topology({ mcpTools, envLabel, demos }: { mcpTools: number; envLabel?: string; demos: number }) {
  const branches: [string, string, number][] = [
    ["Meta-config", "manifest", 24],
    ["Sandbox env", envLabel || "baseline", 66],
    ["Demo runtime", "live agents", 108],
    ["Memory", `${demos} runs`, 150],
  ];
  const node = (x: number, y: number, w: number, h: number, title: string, subtitle: string, accent: string) => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="9" fill="#ffffff" stroke={accent} strokeOpacity="0.45" />
      <text x={x + w / 2} y={y + 19} textAnchor="middle" fontSize="12.5" fontWeight="600" fill="#16213e">{title}</text>
      <text x={x + w / 2} y={y + 33} textAnchor="middle" fontSize="9.5" fill="#6b7689">{subtitle}</text>
    </g>
  );
  const flow = (d: string) => (
    <path d={d} fill="none" stroke="#6d4bff" strokeOpacity="0.6" strokeWidth="1.6" strokeDasharray="3 6">
      <animate attributeName="stroke-dashoffset" from="18" to="0" dur="0.9s" repeatCount="indefinite" />
    </path>
  );
  return (
    <svg viewBox="0 0 900 196" className="h-[150px] w-full" preserveAspectRatio="xMidYMid meet">
      <g>{flow("M168 98 H236")}</g>
      <g>{flow("M404 98 H452")}</g>
      {branches.map(([, , y], i) => <g key={i}>{flow(`M566 98 C600 98, 600 ${y + 17}, 632 ${y + 17}`)}</g>)}
      {node(40, 78, 128, 40, "Claude Code", "over MCP", "#15a35b")}
      {node(236, 78, 168, 40, "Forge MCP server", `${mcpTools} tools`, "#6d4bff")}
      {node(452, 78, 114, 40, "Harness core", "convergence", "#4f7df0")}
      {branches.map(([t, s, y]) => <g key={t}>{node(632, y, 150, 34, t, s, "#7c5cff")}</g>)}
      <g>
        <rect x="40" y="60" width="92" height="15" rx="7" fill="rgba(21,163,91,0.12)" />
        <text x="86" y="71" textAnchor="middle" fontSize="9" fill="#15a35b">no API key</text>
      </g>
    </svg>
  );
}
