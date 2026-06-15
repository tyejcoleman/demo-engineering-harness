import { askJsonAsync } from "@/core/llm.mjs";
import { getBrain } from "@/core/brain.mjs";
import { DEMO_GUIDE, TARGETS } from "@/core/demoguide.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Stage-aware navigation for the Self-learning tab — it reads the brain and guides the user through
// the actual flow (cold start → train → judge → distill → test → compare), the same way the live
// navigator tracks the call phases.
function learnNudge(): { target: string; title: string; tip: string } {
  let b: ReturnType<typeof getBrain> | null = null;
  try {
    b = getBrain();
  } catch {
    b = null;
  }
  const trained = !!(b && b.history && b.history.length);
  const v = b && b.validation;
  if (!trained) return { target: "brain", title: "Cold start — train it", tip: "Press Train brain — watch success climb from a cold, untrained start." };
  if (!(b && b.distilled)) return { target: "brain", title: "Distill the policy", tip: `Learned to ${b ? b.success : 0}% — now Distill to a portable brain that drops the seed data.` };
  if (!v) return { target: "brain", title: "Test on new data", tip: "Distilled — run Test on new data to prove it generalizes vs the untrained baseline." };
  return { target: "brain", title: "Compare the lift", tip: `Generalizes at ${v.success}% vs ${v.baseline}% untrained — switch industry or Reset for a fresh run.` };
}

// Parse the "k=v; k=v" live-state string the client sends.
function parseState(summary: string): Record<string, string> {
  const m: Record<string, string> = {};
  for (const part of String(summary || "").split(";")) {
    const [k, v] = part.split("=");
    if (k && v !== undefined) m[k.trim()] = v.trim();
  }
  return m;
}

// Deterministic fallback so the navigator is NEVER stale: whatever the model does, the gross stage
// (idle → live → resolved) and the live phase are honored here, so it can't say "press Start" mid-call.
function baseline(view: string, s: Record<string, string>): { target: string; title: string; tip: string } {
  const running = s.running === "true";
  const outcome = s.outcome && s.outcome !== "none" ? s.outcome : "";
  const weak = /Lost|Escalated|Churn/i.test(outcome);
  if (view === "learn") return { target: "brain", title: "Train the brain", tip: "Run training — watch customer-success climb as it learns the policy." };
  if (view === "crm") return { target: "profile", title: "Source of truth", tip: "This is the simulated CRM the live agent reasons over." };
  if (view === "mcp") return { target: "none", title: "Manage over MCP", tip: "Every tool here is callable from Claude Code over MCP." };
  if (running) {
    const phase = s.phase || "";
    const byPhase: Record<string, { target: string; title: string; tip: string }> = {
      Connect: { target: "conversation", title: "Call connecting", tip: "Pulling the customer's live CRM record as the call opens." },
      Understand: { target: "conversation", title: "Reading intent", tip: "The agent is parsing the customer's concern in real time." },
      Retrieve: { target: "graph", title: "Grounding", tip: "Retrieving the policies + knowledge that ground the response." },
      Simulate: { target: "assist", title: "Next-best-action", tip: "Watch the AI weigh options against the customer twin." },
      Resolve: { target: "assist", title: "Committing action", tip: "The governed action is being taken — see the assist column." },
    };
    return byPhase[phase] || { target: "graph", title: "Live reasoning", tip: "The context graph is lighting up as the call progresses." };
  }
  if (outcome) {
    return weak
      ? { target: "brain", title: "Weak outcome", tip: "Open Self-learning and train the brain to lift this result." }
      : { target: "outcome", title: "Resolved", tip: "Governed, audited result — try another scenario or industry next." };
  }
  return { target: "conversation", title: "Start a call", tip: "Pick a scenario and press Start call to begin the live demo." };
}

// A low-tier fast model watches the live demo state and decides where to direct the viewer's
// attention — but the gross stage is enforced server-side so the nudge always tracks the flow.
export async function POST(req: Request) {
  const { view, summary } = await req.json().catch(() => ({ view: "", summary: "" }));
  const s = parseState(summary);
  // Non-live tabs navigate deterministically (and stage-aware for Self-learning) — no LLM needed.
  if (view && view !== "demo") {
    const tab = view === "learn" ? learnNudge() : baseline(view, s);
    return Response.json(tab, { headers: { "Cache-Control": "no-store" } });
  }
  const base = baseline(view || "demo", s);
  const running = s.running === "true";
  const resolved = !running && s.outcome && s.outcome !== "none";
  const onLive = !view || view === "demo";
  // Idle live tab is always "press Start" — answer deterministically so polling doesn't spend on the LLM.
  if (onLive && !running && !resolved) return Response.json(base, { headers: { "Cache-Control": "no-store" } });
  const stage = !onLive ? `tab=${view}` : running ? `LIVE CALL IN PROGRESS (phase=${s.phase || "?"})` : resolved ? `call FINISHED (outcome=${s.outcome})` : "idle, no call running";
  try {
    const j = await askJsonAsync(
      `${DEMO_GUIDE}\n\nCurrent view: ${view || "demo"}. STAGE: ${stage}. Live state: ${summary || "(idle)"}.\n` +
        `Rules: if a call is IN PROGRESS, never suggest starting one — comment on the CURRENT phase and point at the active area. If FINISHED, point at the outcome (or Self-learning if it went badly). Only suggest Start when truly idle.\n` +
        `Allowed targets: ${TARGETS.join(", ")}.\nReturn {"target":"<one allowed target>","title":"<=4 words","tip":"<=14 words: why look here now"}`,
      { timeout: 12000, tier: "fast" }
    );
    let target = TARGETS.includes(j.target) ? j.target : base.target;
    let tip = String(j.tip || "").slice(0, 120);
    let title = String(j.title || "").slice(0, 40);
    // GUARD: never let the model fall out of sync with the gross stage.
    const mentionsStart = /\bstart\b|press start|begin the/i.test(tip + " " + title);
    if (running && (mentionsStart || !["conversation", "assist", "graph", "outcome"].includes(target))) return Response.json(base, { headers: { "Cache-Control": "no-store" } });
    if (resolved && mentionsStart) return Response.json(base, { headers: { "Cache-Control": "no-store" } });
    if (!tip) ({ target, title, tip } = base);
    return Response.json({ target, title, tip }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(base, { headers: { "Cache-Control": "no-store" } });
  }
}
