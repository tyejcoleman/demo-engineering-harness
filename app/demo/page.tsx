"use client";

import { useEffect, useRef, useState } from "react";
import { ContextGraph, type Graph } from "@/components/ContextGraph";
import { Platform } from "@/components/Platform";

type Assist = { cat: string; title: string; body?: string; badge?: string; source?: string; branches?: { strategy: string; save: number }[]; chosen?: string; concern?: string; untrained?: number; trained?: number | null; optimal?: number; strategy?: string | null };
type Turn = { who: string; text: string; sentiment: string };
type Trace = { label: string; detail: string };
type Outcome = { saveArr: number; mrr?: number; qa: number; disposition: string; summary: string; concern?: string };
type Situation = { id: string; title: string; premise: string; starter?: string; rationale?: string };
type RunResult = { title: string; disposition: string; qa: number };
type Summary = { claude: boolean; provider: string; target: number; ready: number; demos: number; mcpTools: number; envLabel: string };

const PRESETS: Situation[] = [
  { id: "retention", title: "Retention — outages + price", premise: "A tenured (4-year) Acme Telecom customer calls, frustrated by repeated internet outages and feeling they overpay. They are weighing whether to cancel.", starter: "I've had it — my internet keeps dropping and I'm paying premium prices. I'm ready to cancel." },
  { id: "billing", title: "Billing dispute", premise: "An Acme Telecom customer disputes an unexpected $80 charge after their plan auto-renewed at a higher rate; they feel misled.", starter: "There's an $80 charge on my bill I never authorized and it auto-renewed higher. I want it reversed now." },
  { id: "outage", title: "Outage — small business", premise: "An Acme Telecom small-business owner calls during a regional outage that took down their store's payment system for hours.", starter: "Your outage took down my store's payment system for hours today — what are you going to do about it?" },
  { id: "upgrade", title: "Upgrade / win-back", premise: "An Acme Telecom customer's plan is too slow for new remote work and streaming; a competitor's fiber is tempting them.", starter: "My plan can't handle our remote work and streaming anymore, and a competitor's fiber looks better." },
];

const TABS: [string, string][] = [
  ["demo", "Live demo"],
  ["learn", "Self-learning"],
  ["crm", "CRM"],
  ["mcp", "MCP"],
];
const PHASES = ["Connect", "Understand", "Retrieve", "Simulate", "Resolve", "Done"];
const CAT: Record<string, string> = { context: "border-edge", nba: "border-accent/50 bg-accent/5", knowledge: "border-accent2/40", compliance: "border-warn/40", action: "border-good/40", policy: "border-accent/50 bg-accent/[0.07]", notice: "border-warn/60 bg-warn/10" };
const dispColor = (d: string) => (d === "Saved" || d === "Resolved" ? "bg-good/10 text-good" : d === "Lost" ? "bg-bad/10 text-bad" : "bg-warn/10 text-warn");

function Dots() {
  return (
    <span className="inline-flex gap-1">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  );
}

function Icon({ name, className = "h-3.5 w-3.5" }: { name: string; className?: string }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, viewBox: "0 0 24 24" };
  if (name === "eye") return <svg {...p} className={className}><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" /><circle cx="12" cy="12" r="3" /></svg>;
  if (name === "spark") return <svg {...p} className={className}><path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17l-1.9-5.1L4.5 10l5.6-1.4z" /></svg>;
  if (name === "check") return <svg {...p} className={className}><path d="M20 6L9 17l-5-5" /></svg>;
  if (name === "bolt") return <svg {...p} className={className}><path d="M13 2L3 14h7l-1 8 10-12h-7z" /></svg>;
  return null;
}

// A non-overlapping footer cue (occupies its own row at the bottom of the active panel).
function NudgeTag({ tip }: { title?: string; tip: string }) {
  return (
    <div className="nudge-tag flex shrink-0 items-center gap-1.5 border-t border-accent/30 bg-accent/[0.06] px-3 py-1.5 text-[11px] text-accent">
      <Icon name="eye" className="h-3 w-3 shrink-0" />
      <span className="truncate">{tip}</span>
    </div>
  );
}

export default function Demo() {
  const [situation, setSituation] = useState<Situation>(PRESETS[0]);
  const [gen, setGen] = useState(false);
  const [meta, setMeta] = useState<{ title: string; account: string; format?: string; agentName?: string; brand?: string } | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [assists, setAssists] = useState<Assist[]>([]);
  const [trace, setTrace] = useState<Trace[]>([]);
  const [graph, setGraph] = useState<Graph>({ nodes: [], edges: [], trail: [] });
  const [sentiment, setSentiment] = useState("neutral");
  const [sentTrail, setSentTrail] = useState<string[]>([]);
  const [cxEval, setCxEval] = useState<{ score: number; satisfied: boolean; critique: string; improvement: string } | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [thinking, setThinking] = useState<string | null>(null);
  const [phase, setPhase] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [secs, setSecs] = useState(0);
  const [, setRuns] = useState<RunResult[]>([]);
  const [view, setView] = useState("demo");
  const [about, setAbout] = useState(false);
  const [usage, setUsage] = useState<{ usd: number; cap: number; calls: number; pct: number; over: boolean } | null>(null);
  const [, setSummary] = useState<Summary | null>(null);
  const [scenarios, setScenarios] = useState<Situation[]>(PRESETS);
  const [profiles, setProfiles] = useState<{ id: string; label: string; brand: string; accent?: string }[]>([]);
  const [activeProfile, setActiveProfile] = useState("telecom");
  const [formats, setFormats] = useState<{ id: string; label: string; blurb?: string }[]>([]);
  const [format, setFormat] = useState("agent-assist");
  const [briefing, setBriefing] = useState("");
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(900);
  const [buffered, setBuffered] = useState(0);
  const [safeMode, setSafeMode] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [nudge, setNudge] = useState<{ target: string; title: string; tip: string }>({ target: "none", title: "", tip: "" });
  const nudgeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const bufferRef = useRef<any[]>([]); // live events awaiting reveal
  const fullLogRef = useRef<any[]>([]); // every event of the run (for instant replay)
  const pausedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const convoRef = useRef<HTMLDivElement>(null);
  const assistRef = useRef<HTMLDivElement>(null);
  const traceRef = useRef<HTMLDivElement>(null);
  const sitRef = useRef<Situation>(situation);
  sitRef.current = situation;

  const loadSummary = async () => {
    try {
      const [h, hist, e] = await Promise.all([
        fetch("/api/harness", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/history", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/env", { cache: "no-store" }).then((r) => r.json()),
      ]);
      const ready = h.readiness?.length ? Math.round(h.readiness.reduce((s: number, r: { pct: number }) => s + r.pct, 0) / h.readiness.length) : 0;
      setSummary({ claude: !!h.claude, provider: (h.provider || "").split(" ")[0], target: h.target ?? 90, ready, demos: hist.stats?.total || 0, mcpTools: (h.mcp?.find((m: { id: string; tools?: string[] }) => m.id === "claude-code")?.tools || []).length, envLabel: e.label });
    } catch {
      /* best-effort */
    }
  };

  const pick = (s: Situation) => {
    setSituation(s);
    setTurns(s.starter ? [{ who: "customer", text: s.starter, sentiment: "negative" }] : []);
    setAssists([]);
    setGraph({ nodes: [], edges: [], trail: [] });
    setTrace([]);
    setOutcome(null);
    setPhase("");
  };

  const generate = async () => {
    setGen(true);
    try {
      const seen = [situation.title].filter(Boolean).join("|");
      const r = await fetch(`/api/situation?t=${Date.now()}&recent=${encodeURIComponent(seen)}`, { cache: "no-store" });
      const s = await r.json();
      if (s?.premise) pick({ id: "generated", title: s.title, premise: s.premise, starter: s.starter, rationale: s.rationale });
    } finally {
      setGen(false);
    }
  };

  // Reveal engine: the SSE stream is genuinely live, but events are buffered and revealed one
  // operation at a time under a speed/pause control — so the run can be paused, stepped and replayed
  // while every output stays real (nothing scripted).
  const applyEvent = (d: { kind: string; [k: string]: unknown }) => {
    if (d.kind === "thinking") return setThinking(d.who as string);
    if (d.kind === "trace") return setTrace((t) => [...t, { label: d.label as string, detail: d.detail as string }]);
    if (d.kind === "graph") return setGraph({ nodes: d.nodes as Graph["nodes"], edges: d.edges as Graph["edges"], trail: d.trail as string[] });
    if (d.kind === "phase") return setPhase(d.name as string);
    setThinking(null);
    if (d.kind === "meta") setMeta({ title: d.title as string, account: d.account as string, format: d.format as string, agentName: d.agentName as string, brand: d.brand as string });
    else if (d.kind === "turn") setTurns((t) => (t.length && t[t.length - 1].who === d.who && t[t.length - 1].text === d.text ? t : [...t, d as unknown as Turn]));
    else if (d.kind === "sentiment") { setSentiment(d.value as string); setSentTrail((t) => [...t, d.value as string]); }
    else if (d.kind === "cxeval") setCxEval({ score: d.score as number, satisfied: d.satisfied as boolean, critique: d.critique as string, improvement: d.improvement as string });
    else if (d.kind === "notice") setAssists((a) => [...a, { cat: "notice", title: d.title as string, body: d.body as string }]);
    else if (d.kind === "assist") setAssists((a) => [...a, d as unknown as Assist]);
    else if (d.kind === "outcome") {
      setOutcome(d as unknown as Outcome);
      setRuns((rs) => [...rs, { title: sitRef.current.title, disposition: d.disposition as string, qa: d.qa as number }]);
    }
  };
  const togglePause = () => { const np = !pausedRef.current; pausedRef.current = np; setPaused(np); };
  const stepOne = () => { const d = bufferRef.current.shift(); if (d) applyEvent(d); setBuffered(bufferRef.current.length); };
  const resetStage = () => {
    setTurns(sitRef.current.starter ? [{ who: "customer", text: sitRef.current.starter, sentiment: "negative" }] : []);
    setAssists([]); setTrace([]); setGraph({ nodes: [], edges: [], trail: [] }); setOutcome(null); setSentiment("neutral"); setSentTrail([]); setCxEval(null); setThinking(null); setPhase("");
  };
  const replay = () => { resetStage(); bufferRef.current = [...fullLogRef.current]; setBuffered(bufferRef.current.length); pausedRef.current = false; setPaused(false); };
  // Clean slate: wipe the whole live surface back to a fresh, pre-call state.
  const reset = () => {
    esRef.current?.close();
    if (timerRef.current) clearInterval(timerRef.current);
    bufferRef.current = []; fullLogRef.current = []; setBuffered(0);
    pausedRef.current = false; setPaused(false); setRunning(false);
    setMeta(null); setTurns([]); setAssists([]); setTrace([]);
    setGraph({ nodes: [], edges: [], trail: [] }); setOutcome(null);
    setSentiment("neutral"); setSentTrail([]); setCxEval(null); setThinking(null); setPhase(""); setSecs(0);
  };

  // paced reveal loop
  useEffect(() => {
    const id = setInterval(() => {
      if (pausedRef.current || !bufferRef.current.length) return;
      applyEvent(bufferRef.current.shift());
      setBuffered(bufferRef.current.length);
    }, speed);
    return () => clearInterval(id);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [speed]);

  // Safe mode: persist the last run and replay it deterministically with no network.
  const recKey = () => `forge-rec-${activeProfile}`;
  const saveRecording = (log: unknown[]) => { try { localStorage.setItem(recKey(), JSON.stringify(log)); } catch { /* ignore */ } };
  const loadRecording = (): { kind: string; [k: string]: unknown }[] => { try { return JSON.parse(localStorage.getItem(recKey()) || "[]"); } catch { return []; } };
  useEffect(() => { try { setHasRecording((JSON.parse(localStorage.getItem(recKey()) || "[]") as unknown[]).length > 0); } catch { setHasRecording(false); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeProfile]);

  const start = () => {
    setView("demo");
    esRef.current?.close();
    bufferRef.current = [];
    fullLogRef.current = [];
    setBuffered(0);
    pausedRef.current = false;
    setPaused(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setMeta(null);
    setTurns(sitRef.current.starter ? [{ who: "customer", text: sitRef.current.starter, sentiment: "negative" }] : []);
    setAssists([]);
    setTrace([]);
    setGraph({ nodes: [], edges: [], trail: [] });
    setOutcome(null);
    setSentiment("neutral");
    setSentTrail([]);
    setCxEval(null);
    setThinking(null);
    setPhase("");
    setSecs(0);
    setRunning(true);
    timerRef.current = setInterval(() => setSecs((s) => s + 1), 1000);

    // SAFE MODE — replay the recorded run for this industry, no LLM/network (demo-day insurance).
    if (safeMode) {
      const saved = loadRecording();
      if (saved.length) {
        fullLogRef.current = [...saved];
        bufferRef.current = [...saved];
        setBuffered(saved.length);
        const drain = setInterval(() => {
          if (!bufferRef.current.length) { clearInterval(drain); setRunning(false); setThinking(null); if (timerRef.current) clearInterval(timerRef.current); }
        }, 300);
        return;
      }
    }

    const s = sitRef.current;
    const es = new EventSource(`/api/demo?live=1&t=${Date.now()}&premise=${encodeURIComponent(s.premise)}&title=${encodeURIComponent(s.title)}&starter=${encodeURIComponent(s.starter || "")}`);
    esRef.current = es;
    es.addEventListener("ev", (e) => {
      const d = JSON.parse((e as MessageEvent).data);
      bufferRef.current.push(d);
      fullLogRef.current.push(d);
      setBuffered(bufferRef.current.length);
    });
    const stop = () => {
      setRunning(false);
      setThinking(null);
      if (timerRef.current) clearInterval(timerRef.current);
      es.close();
      if (fullLogRef.current.length) { saveRecording(fullLogRef.current); setHasRecording(true); }
      loadSummary();
    };
    es.addEventListener("done", stop);
    es.onerror = stop;
  };

  const loadScenarios = async () => {
    try {
      const r = await (await fetch("/api/scenarios", { cache: "no-store" })).json();
      if (Array.isArray(r.scenarios) && r.scenarios.length) {
        setScenarios(r.scenarios);
        return r.scenarios as Situation[];
      }
    } catch {
      /* keep presets */
    }
    return null;
  };

  const loadProfiles = async () => {
    try {
      const r = await (await fetch("/api/profiles", { cache: "no-store" })).json();
      setProfiles(r.profiles || []);
      setFormats(r.formats || []);
      setActiveProfile(r.active || "telecom");
      setFormat(r.format || "agent-assist");
    } catch {
      /* ignore */
    }
  };

  const loadBriefing = async (premise: string) => {
    setBriefing("");
    try {
      const r = await (await fetch(`/api/summary?premise=${encodeURIComponent(premise)}&t=${Date.now()}`, { cache: "no-store" })).json();
      setBriefing(r.summary || "");
    } catch {
      /* ignore */
    }
  };

  const switchProfile = async (id: string) => {
    await fetch("/api/profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setActiveProfile(id);
    const scs = await loadScenarios();
    loadSummary();
    if (scs && scs.length) pick(scs[0]);
  };

  const setFmt = async (f: string) => {
    setFormat(f);
    await fetch("/api/profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ format: f }) });
  };

  useEffect(() => {
    const init = async () => {
      // One-shot per browser session: wipe any server state from a prior visitor so every session
      // starts on a clean, correct demo (untrained brain, default industry, empty history). Survives
      // refresh within a tab; fires fresh on a new tab/visit. The global cost cap is NOT reset.
      try {
        if (typeof window !== "undefined" && !sessionStorage.getItem("forge-session")) {
          sessionStorage.setItem("forge-session", "1");
          await fetch("/api/session/new", { method: "POST" });
        }
      } catch {
        /* best-effort */
      }
      loadSummary();
      loadScenarios();
      loadProfiles();
    };
    init();
    return () => esRef.current?.close();
  }, []);
  useEffect(() => { loadBriefing(situation.premise); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [situation.id]);

  // Instant, state-derived hint (#8) so the navigator never lags the flow; the LLM then enriches it.
  const localHint = (): { target: string; title: string; tip: string } => {
    if (view === "learn") return { target: "brain", title: "Self-learning", tip: "Train the brain and watch accuracy climb." };
    if (view === "crm") return { target: "profile", title: "Source of truth", tip: "The simulated CRM the live agent reasons over." };
    if (view === "mcp") return { target: "none", title: "MCP", tip: "Drive the whole platform from Claude Code." };
    if (running) {
      const byPhase: Record<string, { target: string; title: string; tip: string }> = {
        Connect: { target: "conversation", title: "Connecting", tip: "Pulling the customer's live CRM record." },
        Understand: { target: "conversation", title: "Reading intent", tip: "Parsing the customer's concern in real time." },
        Retrieve: { target: "graph", title: "Grounding", tip: "Retrieving the policy that grounds the reply." },
        Simulate: { target: "assist", title: "Next-best-action", tip: "Weighing strategies against the customer twin." },
        Resolve: { target: "assist", title: "Committing", tip: "Taking the governed, audited action." },
      };
      return byPhase[phase] || { target: "graph", title: "Live reasoning", tip: "The context graph lights up as it reasons." };
    }
    if (outcome) return outcome.disposition === "Lost" || outcome.disposition === "Escalated" ? { target: "brain", title: "Improve it", tip: "Train the brain to lift this outcome." } : { target: "outcome", title: "Resolved", tip: "Governed, audited result — try another scenario." };
    return { target: "conversation", title: "Start a call", tip: "Pick a scenario and press Start call." };
  };
  // AI attention guide: a fast model watches the live state and decides where to nudge the viewer.
  const askNudge = async () => {
    const summary = `running=${running}; phase=${phase || "idle"}; turns=${turns.length}; assists=${assists.length}; sentiment=${sentiment}; graphNodes=${graph.nodes.length}; outcome=${outcome ? outcome.disposition : "none"}; profile=${activeProfile}; format=${format}`;
    try {
      const r = await (await fetch("/api/nudge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ view, summary }) })).json();
      setNudge(r || localHint());
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    setNudge(localHint()); // instant, then the LLM refines on the next line
    askNudge();
    if (nudgeTimerRef.current) clearInterval(nudgeTimerRef.current);
    nudgeTimerRef.current = setInterval(askNudge, running ? 6000 : 9000);
    return () => { if (nudgeTimerRef.current) clearInterval(nudgeTimerRef.current); };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [view, running, phase, outcome, turns.length, assists.length]);
  useEffect(() => { if (about) fetch("/api/usage", { cache: "no-store" }).then((r) => r.json()).then(setUsage).catch(() => {}); }, [about, outcome]);
  useEffect(() => { if (convoRef.current) convoRef.current.scrollTop = convoRef.current.scrollHeight; }, [turns, thinking]);
  useEffect(() => { if (assistRef.current) assistRef.current.scrollTop = assistRef.current.scrollHeight; }, [assists, thinking]);
  useEffect(() => { if (traceRef.current) traceRef.current.scrollTop = traceRef.current.scrollHeight; }, [trace]);

  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const sentColor = sentiment === "negative" ? "bg-bad" : sentiment === "positive" ? "bg-good" : "bg-muted";
  const phaseIdx = PHASES.indexOf(phase);
  const count = (t: string) => graph.nodes.filter((n) => n.type === t).length;
  const path = (graph.trail || []).map((id) => graph.nodes.find((n) => n.id === id)?.label).filter(Boolean) as string[];
  const ring = (k: string) => (nudge.target === k ? " nudge-glow" : "");

  // Live QA / coherence: ticks up as the agent grounds, governs, complies, simulates and consults the brain.
  const cohSignals = [
    { key: "grounded citation", on: assists.some((a) => a.cat === "knowledge") },
    { key: "policy consult", on: assists.some((a) => a.cat === "policy") },
    { key: "outcome simulation", on: assists.some((a) => a.cat === "simulation") },
    { key: "governed action", on: trace.some((t) => t.label === "governance") || assists.some((a) => a.cat === "action") },
    { key: "compliance check", on: assists.some((a) => a.cat === "compliance") },
  ];
  const coherence = Math.round((100 * cohSignals.filter((s) => s.on).length) / cohSignals.length);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {about && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 p-6 pt-20" onClick={() => setAbout(false)}>
          <div className="card max-w-lg p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><div className="text-base font-semibold text-fg">How it works</div><button onClick={() => setAbout(false)} className="text-xs text-muted transition hover:text-fg">close ✕</button></div>
            <p className="mt-2 text-sm leading-relaxed text-muted">Every output is generated <b className="text-fg">live by real LLMs</b> — nothing is scripted or hardcoded. You control the <b className="text-fg">reveal pace</b> (pause · step · speed) and can replay a run, but the content is real each time.</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-muted">
              <li><b className="text-fg">Live demo</b> — a real contact-center call: the agent reasons, grounds in the knowledge base, simulates strategies against a digital-twin customer, and takes a governed, audited action; the context graph lights up as it reasons.</li>
              <li><b className="text-fg">CRM</b> — a simulated source-of-truth book of business per industry (the Salesforce / Zendesk analog).</li>
              <li><b className="text-fg">Self-learning</b> — a brain accumulates outcome evidence in the context graph, learns the best strategy per concern, a judge LLM proposes improvements, then it&apos;s distilled and tested on unseen data.</li>
              <li><b className="text-fg">MCP</b> — connect any Claude Code to drive and manage the whole platform via tools; every change is audited.</li>
            </ul>
            <p className="mt-3 text-[12px] text-muted">Switch <b className="text-fg">Industry</b> in the banner to swap the entire dataset (CRM, scenarios, knowledge).</p>
            {usage && (
              <div className="mt-3 rounded-lg border border-edge bg-panel2 px-3 py-2">
                <div className="flex items-center justify-between text-[11px]"><span className="text-muted">Today&apos;s LLM spend (est.)</span><span className={`tabular-nums font-medium ${usage.over ? "text-bad" : "text-fg"}`}>${usage.usd.toFixed(4)} / ${usage.cap.toFixed(2)}</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-edge"><div className={`h-full rounded-full ${usage.over ? "bg-bad" : usage.pct > 70 ? "bg-warn" : "bg-good"}`} style={{ width: `${usage.pct}%` }} /></div>
                <div className="mt-1 text-[10px] text-muted">{usage.calls} model calls · hard daily cap protects the public link · resets 00:00 UTC</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── HEADER (compact, no logo): brand + live platform stats + tabs ── */}
      <header className="shrink-0 border-b border-edge bg-panel/85 backdrop-blur">
        <div className="mx-auto w-full max-w-[1600px] px-6">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
            <div className="flex items-baseline gap-2">
              <span className="text-base font-semibold tracking-tight text-fg">Demo Engineering Harness</span>
              <span className="text-[11px] text-muted">intelligent demo platform</span>
              <button onClick={() => setAbout((a) => !a)} className="ml-1 grid h-4 w-4 place-items-center self-center rounded-full border border-edge text-[10px] text-muted transition hover:border-accent hover:text-accent" title="How this works">?</button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-[10px] uppercase tracking-wider text-muted">Industry</span>
              <select value={activeProfile} onChange={(e) => switchProfile(e.target.value)} className="rounded-lg border border-edge bg-panel px-2.5 py-1 text-xs font-medium text-fg outline-none transition focus:border-accent">
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 pb-2">
            <div className="flex flex-wrap gap-1.5">
              {TABS.map(([id, label]) => (
                <button key={id} onClick={() => setView(id)} className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${view === id ? "bg-accent text-white shadow-sm" : "bg-panel2 text-muted hover:text-fg"}`}>
                  {label}
                </button>
              ))}
            </div>
            {nudge.tip && (
              <div className="hidden min-w-0 items-center gap-2 text-[11px] md:flex">
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/40 bg-accent/5 px-2 py-0.5 font-medium text-accent"><Icon name="eye" className="h-3 w-3" /> AI navigator</span>
                <span className="truncate text-muted">{nudge.title ? <b className="font-medium text-fg">{nudge.title} · </b> : null}{nudge.tip}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── BODY (fills the viewport; nothing scrolls the page) ── */}
      <div className="mx-auto flex w-full min-h-0 max-w-[1600px] flex-1 flex-col overflow-hidden px-6 py-3">
        {/* platform surfaces scroll internally */}
        {view !== "demo" && (
          <div className="min-h-0 flex-1 overflow-hidden">
            <Platform key={activeProfile} tab={view} onLoad={(s) => { pick({ id: "generated", title: s.title, premise: s.premise, starter: s.starter, rationale: s.rationale }); setView("demo"); }} />
          </div>
        )}

        {/* LIVE DEMO — fits the screen */}
        {view === "demo" && (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* controls */}
            <div className="shrink-0">
              {/* Start call + POC format toggle */}
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {(running || buffered > 0) && (
                    <>
                      <button onClick={togglePause} className="btn-ghost !px-2.5 !py-1 !text-xs">{paused ? "Play" : "Pause"}</button>
                      <button onClick={stepOne} disabled={buffered === 0} className="btn-ghost !px-2.5 !py-1 !text-xs disabled:opacity-40">Step</button>
                    </>
                  )}
                  {outcome && !running && <button onClick={replay} className="btn-ghost !px-2.5 !py-1 !text-xs">Replay</button>}
                  {outcome && !running && <button onClick={reset} className="btn-ghost !px-2.5 !py-1 !text-xs">Reset</button>}
                  <span className="flex items-center gap-1 text-[10px] text-muted">Speed
                    <input type="range" min={250} max={1600} step={50} value={1850 - speed} onChange={(e) => setSpeed(1850 - Number(e.target.value))} className="w-20 accent-[#6d4bff]" />
                  </span>
                  <button onClick={() => setSafeMode((s) => !s)} disabled={running} title="Demo-day insurance: replay the last recorded run with no network/LLM" className={`btn-ghost !px-2.5 !py-1 !text-xs disabled:opacity-40 ${safeMode ? "!border-good !text-good" : ""}`}>{safeMode ? "● Safe mode" : "Safe mode"}{safeMode && !hasRecording ? " (no rec)" : ""}</button>
                  {buffered > 0 && <span className="text-[10px] text-accent">{buffered} queued</span>}
                </div>
                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-1 rounded-lg border border-edge bg-panel2 p-0.5${ring("format")}`}>
                    <span className="px-1 text-[10px] uppercase tracking-wider text-muted">Format</span>
                    {formats.map((f) => (
                      <button key={f.id} onClick={() => setFmt(f.id)} disabled={running} title={f.blurb} className={`rounded-md px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${format === f.id ? "bg-accent text-white" : "text-muted hover:text-fg"}`}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <button onClick={start} disabled={running || gen} className="btn-primary">{running ? "● Live" : outcome ? "Run again" : "Start call"}</button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-muted">Scenario</span>
                <select
                  value={situation.id}
                  onChange={(e) => { const s = scenarios.find((x) => x.id === e.target.value); if (s) pick(s); }}
                  disabled={running}
                  className="rounded-lg border border-edge bg-panel px-2.5 py-1 text-xs text-fg outline-none transition focus:border-accent disabled:opacity-50"
                >
                  {scenarios.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                  {situation.id === "generated" && <option value="generated">{situation.title}</option>}
                </select>
                <button onClick={generate} disabled={running || gen} className="inline-flex items-center gap-1 rounded-full border border-accent2/40 bg-accent2/5 px-3 py-1 text-xs font-medium text-accent2 transition hover:border-accent2 disabled:opacity-50">
                  {gen ? "generating…" : <><Icon name="spark" className="h-3 w-3" /> Generate</>}
                </button>
                <div className="ml-auto flex items-center gap-3">
                  <span className="font-mono text-xs text-muted">{mm}:{ss}</span>
                </div>
              </div>
              {situation.id === "generated" && situation.rationale && (
                <div className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-snug text-accent">
                  <Icon name="spark" className="mt-0.5 h-3 w-3 shrink-0" />
                  <span><b className="font-medium">AI chose this scenario · </b>{situation.rationale}</span>
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {PHASES.map((p, i) => {
                  const active = phaseIdx >= i && phaseIdx >= 0;
                  const cur = phase === p;
                  return (
                    <div key={p} className="flex items-center gap-1.5">
                      <div className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${cur ? "bg-accent text-white" : active ? "bg-accent/10 text-accent" : "bg-panel2 text-muted"}`}>
                        {cur && running ? <span className="mr-1 inline-block animate-pulse">●</span> : null}{p}
                      </div>
                      {i < PHASES.length - 1 && <div className={`h-px w-5 ${active ? "bg-accent/40" : "bg-edge"}`} />}
                    </div>
                  );
                })}
                <span className="ml-2 truncate text-[11px] text-muted">
                  <span className="font-medium text-fg">{meta ? meta.account : "account generated live on Start"}</span>
                  {path.length > 1 && <span className="text-accent"> · {path.join(" → ")}</span>}
                </span>
              </div>
            </div>

            {/* stage — fills remaining height */}
            <div className="mt-2 grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-12">
              {/* LIVE CALL */}
              <section className={`card flex min-h-0 flex-col overflow-hidden lg:col-span-4${ring("conversation")}`}>
                <div className="flex shrink-0 items-center justify-between border-b border-edge bg-panel2 px-4 py-2 label">
                  <span className="flex items-center gap-2">Live call <span className="chip !py-0 !text-[9px]"><span className="h-1 w-1 rounded-full bg-accent2" /> Gemini</span></span>
                  <span className="flex items-center gap-1.5">
                    {sentTrail.length > 1 && (
                      <span className="flex items-end gap-[2px] normal-case" title="customer sentiment over the call">
                        {sentTrail.slice(-14).map((s, i) => (
                          <span key={i} className={`w-[3px] rounded-sm ${s === "positive" ? "bg-good" : s === "negative" ? "bg-bad" : "bg-muted/60"}`} style={{ height: `${s === "positive" ? 12 : s === "negative" ? 4 : 8}px` }} />
                        ))}
                      </span>
                    )}
                    <span className={`h-2 w-2 rounded-full ${sentColor} ${running ? "animate-pulse" : ""}`} /> {sentiment}
                  </span>
                </div>
                <div ref={convoRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                  {turns.length === 0 && !running && <div className="text-sm text-muted">The customer opens the call here, live — pick a situation and press Start call.</div>}
                  {turns.map((t, i) => (
                    <div key={i} className={`flex ${t.who === "agent" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${t.who === "agent" ? "bg-accent/10 text-fg" : "card-inset"}`}>
                        <div className={`mb-1 text-[10px] uppercase tracking-wider ${t.who === "agent" ? "text-accent" : "text-muted"}`}>{t.who === "agent" ? (meta?.format === "ai-agent" ? `AI Agent${meta?.brand ? " · " + meta.brand : ""}` : `${meta?.agentName || "Agent"}${meta?.brand ? " · " + meta.brand : ""}`) : "Customer"}</div>
                        {t.text}
                      </div>
                    </div>
                  ))}
                  {(thinking === "customer" || thinking === "agent") && (
                    <div className={`flex ${thinking === "agent" ? "justify-end" : "justify-start"}`}>
                      <div className="card-inset flex items-center gap-2 px-3.5 py-2.5 text-muted"><span className="text-[10px] uppercase tracking-wider">{thinking === "agent" ? "Maya" : "customer"}</span><Dots /></div>
                    </div>
                  )}
                </div>
                {nudge.target === "conversation" && <NudgeTag tip={nudge.tip} />}
              </section>

              {/* AI REASONING */}
              <section className={`card flex min-h-0 flex-col overflow-hidden lg:col-span-3${ring("assist")}`}>
                <div className="flex shrink-0 items-center justify-between border-b border-edge bg-panel2 px-4 py-2 label">
                  <span>AI reasoning · real-time</span>
                  {(running || assists.length > 0) && (
                    <span className="flex items-center gap-1.5 normal-case tracking-normal" title={cohSignals.map((s) => `${s.on ? "✓" : "·"} ${s.key}`).join("\n")}>
                      <span className="text-[10px] text-muted">QA coherence</span>
                      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-edge"><span className={`block h-full rounded-full transition-all ${coherence >= 80 ? "bg-good" : coherence >= 50 ? "bg-warn" : "bg-bad"}`} style={{ width: `${coherence}%` }} /></span>
                      <span className="tabular-nums text-[11px] font-medium text-fg">{coherence}%</span>
                    </span>
                  )}
                </div>
                <div ref={assistRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3.5">
                  {assists.length === 0 && !running && <div className="text-sm text-muted">The assist agent's guidance, retrieved knowledge, outcome simulation and the action it takes appear here as the call unfolds.</div>}
                  {assists.map((a, i) =>
                    a.cat === "compare" ? (
                      <div key={i} className="fadeup rounded-xl border border-accent2/40 bg-accent2/5 p-3">
                        <div className="text-sm font-semibold text-fg">{a.title}</div>
                        <div className="mt-0.5 text-[11px] text-muted">concern: {a.concern}{a.strategy ? ` · trained pick: ${a.strategy}` : ""}</div>
                        <div className="mt-2 space-y-1.5">
                          <div>
                            <div className="flex justify-between text-[11px]"><span className="text-muted">before self-learning</span><span className="tabular-nums text-bad">{a.untrained ?? 0}%</span></div>
                            <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-edge"><div className="h-full rounded-full bg-bad/60" style={{ width: `${a.untrained ?? 0}%` }} /></div>
                          </div>
                          {a.trained != null && (
                            <div>
                              <div className="flex justify-between text-[11px]"><span className="text-fg">after self-learning</span><span className="tabular-nums text-good">{a.trained}%</span></div>
                              <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-edge"><div className="h-full rounded-full bg-good" style={{ width: `${a.trained}%` }} /></div>
                            </div>
                          )}
                        </div>
                        {a.trained != null && a.untrained != null ? (
                          <div className="mt-1.5 text-[11px] text-good">+{Math.max(0, a.trained - a.untrained)} pts expected save-rate from self-learning</div>
                        ) : (
                          <div className="mt-1.5 text-[11px] text-muted">Brain untrained for this concern — train it (Self-learning tab) to lift this.</div>
                        )}
                      </div>
                    ) : a.cat === "simulation" && a.branches ? (
                      <div key={i} className="fadeup rounded-xl border border-accent/40 bg-accent/5 p-3">
                        <div className="text-sm font-semibold text-fg">{a.title}</div>
                        <div className="mt-2 space-y-2">
                          {a.branches.map((b, bi) => (
                            <div key={bi}>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className={b.strategy === a.chosen ? "font-medium text-fg" : "text-muted"}>{b.strategy === a.chosen ? "✓ " : ""}{b.strategy}</span>
                                <span className="ml-2 tabular-nums text-fg">{b.save}%</span>
                              </div>
                              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-edge"><div className={`h-full rounded-full ${b.strategy === a.chosen ? "bg-accent" : "bg-muted/40"}`} style={{ width: `${b.save}%` }} /></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div key={i} className={`fadeup rounded-xl border bg-panel p-3 ${CAT[a.cat] || "border-edge"}`}>
                        <div className="flex items-center justify-between gap-2"><div className="text-sm font-semibold text-fg">{a.title}</div>{a.badge && <span className="shrink-0 rounded-full bg-panel2 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">{a.badge}</span>}</div>
                        <div className="mt-1 text-sm leading-relaxed text-fg/90">{a.body}</div>
                        {a.source && <div className="mt-1.5 text-[11px] text-accent2">source · {a.source}</div>}
                      </div>
                    )
                  )}
                  {thinking === "assist" && <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm text-accent">assist analyzing <Dots /></div>}
                </div>
                <div ref={traceRef} className="h-24 shrink-0 overflow-y-auto border-t border-edge bg-panel2 px-3.5 py-2 font-mono text-[10px]">
                  {trace.length === 0 && <div className="text-muted">backend trace …</div>}
                  {trace.map((t, i) => (
                    <div key={i} className="flex gap-2">
                      <span className={`mt-1 h-1 w-1 shrink-0 rounded-full ${i === trace.length - 1 && running ? "animate-pulse bg-accent" : "bg-muted/50"}`} />
                      <div><span className="text-accent">{t.label}</span>{t.detail && <span className="text-muted"> · {t.detail}</span>}</div>
                    </div>
                  ))}
                </div>
                {nudge.target === "assist" && <NudgeTag tip={nudge.tip} />}
              </section>

              {/* CONTEXT GRAPH */}
              <section className={`card flex min-h-0 flex-col overflow-hidden lg:col-span-5${ring("graph")}`}>
                <div className="flex shrink-0 items-center justify-between border-b border-edge bg-panel2 px-4 py-2 label">
                  <span>Context graph · live reasoning</span>
                  <span className="text-muted">{graph.nodes.length} nodes · {count("strategy") + count("chosen")} strategies</span>
                </div>
                {briefing && <div className="shrink-0 border-b border-edge bg-accent/[0.04] px-4 py-2 text-[11px] leading-relaxed text-fg/80"><span className="font-medium text-accent">Environment briefing · </span>{briefing}</div>}
                <div className="relative min-h-0 flex-1">
                  {graph.nodes.length === 0 ? (
                    <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">{running ? "building the scene…" : "The account context + the agents' reasoning render here as a live 3D graph. Click any node to trace it."}</div>
                  ) : (
                    <ContextGraph graph={graph} />
                  )}
                </div>
                {nudge.target === "graph" && <NudgeTag tip={nudge.tip} />}
              </section>
            </div>

            {/* outcome — slim strip with ROI economics, no extra page height */}
            {outcome && (() => {
              const won = outcome.disposition === "Saved" || outcome.disposition === "Resolved";
              const esc = outcome.disposition === "Escalated";
              const fleet = won ? outcome.saveArr * 100 : 0; // illustrative: 100 comparable resolutions/yr
              return (
                <div className={`mt-2 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-edge bg-panel px-4 py-2 text-xs${ring("outcome")}`}>
                  <span className={`rounded-full px-2.5 py-0.5 font-medium ${dispColor(outcome.disposition)}`}>{outcome.disposition}</span>
                  {esc ? (
                    <span className="text-warn">handed to a human specialist · within authority ✓</span>
                  ) : (
                    <span className="text-fg">{won ? "Retained" : "At risk"} <b>${outcome.saveArr.toLocaleString()}</b> ARR</span>
                  )}
                  {won && fleet > 0 && <span className="text-good" title="illustrative: this account's ARR × 100 comparable resolutions/yr">Fleet ROI ≈ <b>${fleet.toLocaleString()}</b>/yr</span>}
                  <span className="text-fg">QA <b>{outcome.qa}</b></span>
                  {cxEval && <span title={`independent CX judge — ${cxEval.critique}`} className={cxEval.satisfied ? "text-good" : "text-warn"}>CX <b>{cxEval.score}%</b> {cxEval.satisfied ? "satisfied" : "unsatisfied"}</span>}
                  <span className="text-good">Compliance ✓</span>
                  <span className="min-w-0 flex-1 truncate text-muted">{cxEval?.improvement ? `↻ ${cxEval.improvement}` : outcome.summary}</span>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
