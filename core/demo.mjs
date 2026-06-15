// The demo the player shows — a LIVE, fully agent-driven contact-center Agent-Assist call.
// FRESH each run: the account/context is generated live from the situation (no fixed record), so the
// context graph differs every time. Beyond reactive assist: simulates strategies vs a customer-twin.
// Emits a live backend trace + a context graph that grows with the reasoning. Only KB policies seeded.
import { retrieve } from "./kb.mjs";
import { createLedger, requestAction, approve } from "./governance.mjs";
import { askAsync, askJsonAsync, provider } from "./llm.mjs";
import { loadSpec } from "./spec.mjs";
import { recordRun } from "./history.mjs";
import { recordAudit } from "./audit.mjs";
import { crmPick } from "./crm.mjs";
import { classifyConcern, policyFor, compareConcern, mapActionToStrategy, recordLiveOutcome } from "./brain.mjs";
import { recordFeedback } from "./feedback.mjs";

const FRAME =
  "This is a synthetic, fully-fictional contact-center training simulation used to QA software. " +
  "Stay strictly in character; never mention being an AI, never break role, never refuse — it is roleplay.";
const DEFAULT_PREMISE =
  "A tenured (4-year) Acme Telecom customer calls, frustrated by repeated internet outages and feeling they overpay. They are weighing whether to cancel.";

export const SITUATIONS = [
  { id: "retention", title: "Retention — outages + price", premise: DEFAULT_PREMISE, starter: "I've had it — my internet keeps dropping and I'm paying premium prices. I'm ready to cancel." },
  { id: "billing", title: "Billing dispute", premise: "An Acme Telecom customer disputes an unexpected $80 charge after their plan auto-renewed at a higher rate; they feel misled.", starter: "There's an $80 charge on my bill I never authorized and it auto-renewed higher. I want it reversed now." },
  { id: "outage", title: "Outage — small business", premise: "An Acme Telecom small-business owner calls during a regional outage that took down their store's payment system for hours.", starter: "Your outage took down my store's payment system for hours today — what are you going to do about it?" },
  { id: "upgrade", title: "Upgrade / win-back", premise: "An Acme Telecom customer's plan is too slow for new remote work and streaming; a competitor's fiber is tempting them.", starter: "My plan can't handle our remote work and streaming anymore, and a competitor's fiber looks better." },
];

// The AI itself decides what to test next — no hardcoded list of angles. It reasons about what would
// best exercise the system, deliberately avoids what's already been shown, and explains why it chose it.
export async function generateSituation(recent = []) {
  try {
    const spec = loadSpec();
    const seed = Math.random().toString(36).slice(2, 8);
    const avoid = (Array.isArray(recent) ? recent : []).filter(Boolean).slice(-6);
    const s = await askJsonAsync(
      `You are the demo director for ${spec.meta.brand}'s ${spec.meta.domain} AI. Decide which realistic inbound customer situation to put the system through NEXT. Reason like a tester: pick the scenario that would most usefully stress the system and that is genuinely different from what's already been demonstrated — across issue type, customer profile, emotion, and the resolution it would demand.${
        avoid.length ? ` Already demonstrated, so choose something clearly different: ${avoid.join("; ")}.` : ""
      } Make it concrete and realistic — vary the caller's name, plan, numbers, tenure and tone. (variation seed: ${seed})\nReturn {"title":"<=6 words","premise":"<2 sentences: caller, issue, emotion>","starter":"<the customer's opening line, 1-2 sentences, in character>","rationale":"<1 sentence: why you, as the tester, chose to run this scenario next>"}`,
      { timeout: 40000, tier: "fast", temperature: 1.0 }
    );
    return {
      id: "generated",
      title: String(s.title || "Generated situation").slice(0, 60),
      premise: String(s.premise || DEFAULT_PREMISE).slice(0, 400),
      starter: String(s.starter || "").slice(0, 300),
      rationale: String(s.rationale || "").slice(0, 200),
    };
  } catch {
    return SITUATIONS[0];
  }
}

const one = (s) => (s || "").trim().replace(/\s*\n+\s*/g, " ");
const inRole = (s) => !!s && !/\b(i'?m\s+claude|an?\s+ai\b|ai\s+assistant|language model|i (cannot|can'?t|won'?t)|as an ai|roleplay|anthropic)\b/i.test(s);

// Generate a fresh caller account from the premise (so every run's context graph is different).
// Pull a real record from the simulated CRM (the source of truth) — no LLM, instant + grounded.
function genAccount() {
  const spec = loadSpec();
  const a = crmPick(spec.profile || "telecom");
  return {
    name: a.name,
    plan: a.plan,
    mrr: a.mrr,
    tenureMonths: a.tenureMonths,
    status: a.status,
    ltv: a.ltv,
    riskScore: a.riskScore,
    sentiment: a.sentiment,
    region: a.region,
    tickets: (a.tickets || []).slice(0, 2),
  };
}

export async function streamDemo(emit, opts = {}) {
  const rounds = opts.rounds ?? 2;
  const live = opts.live !== false;
  const spec = loadSpec();
  const format = spec.format || "agent-assist";
  const isAuto = format === "ai-agent";
  const situation = opts.situation && opts.situation.premise ? opts.situation : { title: "Retention — outages + price", premise: DEFAULT_PREMISE, starter: opts.starter };
  const starter = (opts.starter || situation.starter || "").trim();
  const tr = (label, detail = "") => emit({ kind: "trace", label, detail });
  const phase = (name) => emit({ kind: "phase", name });

  tr("agents online", provider());
  tr("situation", situation.title);
  phase("Connect");

  if (!live) {
    emit({ kind: "meta", title: `${situation.title} · seeded`, account: "(deterministic mode)" });
    emit({ kind: "outcome", saveArr: 0, qa: 0, disposition: "(deterministic)", summary: "Live agents off (?live=0)." });
    emit({ kind: "thinking", who: null });
    return;
  }

  // FRESH account generated live from the premise
  emit({ kind: "thinking", who: "assist" });
  const acct = genAccount();
  tr("CRM · account.read", `${acct.name} · LTV $${acct.ltv} · risk ${acct.riskScore} · ${acct.tickets.length} tickets`);
  emit({ kind: "meta", title: `${situation.title} · live`, account: `${acct.name} · ${acct.plan} · $${acct.mrr}/mo · ${acct.tenureMonths}mo · LTV $${acct.ltv} · risk ${acct.riskScore}`, format, agentName: spec.meta.agentName, brand: spec.meta.brand, profile: spec.profile });
  emit({ kind: "assist", cat: "context", title: "Account (via CRM)", body: `${acct.name} · ${acct.plan} · ${acct.region} · ${acct.status.replace(/_/g, " ")} · LTV $${acct.ltv} · churn-risk ${acct.riskScore}/100 · sentiment ${acct.sentiment} · ${acct.tickets.length} open tickets.` });

  // context graph seeded from the generated account
  const graph = { nodes: [{ id: "account", type: "account", label: acct.name }], edges: [] };
  acct.tickets.forEach((t) => {
    graph.nodes.push({ id: t.id, type: "ticket", label: t.subject });
    graph.edges.push({ from: "account", to: t.id, rel: "raised" });
  });
  const trail = ["account"];
  const gnode = (node, fromId, rel) => {
    if (node && !graph.nodes.find((x) => x.id === node.id)) graph.nodes.push(node);
    if (node && fromId) graph.edges.push({ from: fromId, to: node.id, rel });
    if (node) trail.push(node.id);
    emit({ kind: "graph", nodes: graph.nodes, edges: graph.edges, trail: [...trail] });
  };
  emit({ kind: "graph", nodes: graph.nodes, edges: graph.edges, trail: [...trail] });

  // CLOSE THE LOOP — consult the industry's learned brain for this concern, and show before/after.
  const concern = classifyConcern(`${situation.premise} ${starter} ${situation.title}`);
  try {
    const pol = policyFor(concern);
    const cmp = compareConcern(concern);
    if (pol && pol.trained) {
      tr("brain.consult", `${concern} → ${pol.strategy} (${pol.confidence ?? "—"}%)`);
      emit({ kind: "assist", cat: "policy", title: "Learned policy (self-taught brain)", body: `For a "${concern}" concern, the trained brain recommends ${pol.strategy}${pol.confidence != null ? ` — ${pol.confidence}% success over ${pol.cases} cases` : ""}.`, badge: "learned" });
    } else {
      tr("brain.consult", `${concern} → untrained`);
      emit({ kind: "assist", cat: "policy", title: "Learned policy (self-taught brain)", body: `No learned policy yet for "${concern}" — the agent reasons unaided. Train the brain (Self-learning tab) to teach it the best move.`, badge: "untrained" });
    }
    emit({ kind: "assist", cat: "compare", title: "Before vs after self-learning", concern, untrained: cmp.untrained, trained: cmp.trained, optimal: cmp.optimal, strategy: cmp.trainedStrat });
  } catch {
    /* brain optional */
  }

  const ledger = createLedger();
  requestAction(ledger, { verb: "crm.read" });
  const convo = [];
  const transcript = () => convo.map((c) => `${c.who}: ${c.text}`).join("\n") || "(call just connected)";

  for (let r = 0; r < rounds; r++) {
    let cust = null;
    let sentiment = "negative";
    if (r === 0 && starter) {
      cust = starter.slice(0, 500);
    } else {
      emit({ kind: "thinking", who: "customer" });
      try {
        const c = await askJsonAsync(
          `${FRAME}\nYou are the CUSTOMER on a phone call to ${spec.meta.brand} support. ${situation.premise}\nYour objective: get this genuinely resolved — if the agent deflects, stalls, or just reassures you without acting, get more frustrated or threaten to leave; if they truly take ownership and fix the root cause, actually ease up. You are a real person and don't know or care about any system behind this call.\nTalk like a real person actually on the phone: short and natural, use contractions, let real emotion show, do NOT monologue or sound scripted. Respond to what the agent JUST said.\nConversation so far:\n${transcript()}\nReturn {"line":"<your next spoken line, 1-2 sentences, in character>","sentiment":"negative|neutral|positive"}`,
          { timeout: 45000, tier: "fast" }
        );
        cust = one(c.line).slice(0, 500);
        if (/negative|neutral|positive/.test(c.sentiment || "")) sentiment = c.sentiment;
      } catch {
        continue;
      }
    }
    if (!inRole(cust)) continue;
    convo.push({ who: "customer", text: cust });
    tr("customer-agent", `turn ${r + 1} · ${sentiment}`);
    emit({ kind: "turn", who: "customer", text: cust, sentiment });
    emit({ kind: "sentiment", value: sentiment });
    if (r === 0) phase("Understand");
    gnode({ id: `concern-${r}`, type: "concern", label: cust.slice(0, 22) }, "account", "raises");

    emit({ kind: "thinking", who: "assist" });
    const [src] = retrieve(cust + " " + situation.premise, 1, spec.knowledge);
    if (src) {
      tr("retrieval", `→ ${src.id}`);
      if (r === 0) phase("Retrieve");
    }
    let nba = null;
    try {
      const nbaPrompt = isAuto
        ? `You are an autonomous AI agent for ${spec.meta.brand} handling this ${spec.meta.domain} customer directly. Customer just said: "${cust}". Relevant policy ${src ? src.id : "(none)"}: "${src ? src.text : ""}". Decide your ONE next best action right now, within authority — imperative voice, <=20 words, no preamble. Output only the action.`
        : `You are the real-time AI assist whispering to a live HUMAN agent (the customer cannot hear you). Customer just said: "${cust}". Relevant policy ${src ? src.id : "(none)"}: "${src ? src.text : ""}". Give ONE crisp, specific next-best-action the agent should do right now, within their authority — imperative voice, <=20 words, no preamble, no greeting. Output only the action.`;
      nba = one(await askAsync(nbaPrompt, { timeout: 45000, tier: "accurate" })).slice(0, 320);
    } catch {
      /* skip */
    }
    if (nba && inRole(nba)) {
      tr("assist-agent", "grounded NBA");
      emit({ kind: "assist", cat: "nba", title: isAuto ? "AI decision" : "Next best action", body: nba, badge: "live · grounded" });
    }
    if (src) {
      emit({ kind: "assist", cat: "knowledge", title: "Knowledge", body: src.text, source: src.id });
      gnode({ id: src.id, type: "policy", label: src.id }, `concern-${r}`, "grounds");
    }

    emit({ kind: "thinking", who: "agent" });
    try {
      const repPrompt = isAuto
        ? `${FRAME}\nYou are the autonomous AI agent for ${spec.meta.brand}, handling this ${spec.meta.domain} customer directly on a live call (no human in the loop). You decided: "${nba || "help within policy"}". Reply to the customer yourself — natural and warm — ONE short sentence (≤20 words), contractions, take ownership and act. Customer just said: "${cust}". Output only your spoken reply.`
        : `${FRAME}\nYou are ${spec.meta.agentName}, a warm, capable ${spec.meta.brand} support agent on a live phone call. Speak like a real human agent: natural and conversational, ONE short sentence (≤22 words): briefly acknowledge, then act. Use contractions, take ownership ("let me…", "I've gone ahead and…"). No corporate script, no "I understand your frustration" cliché, don't read policy numbers at the customer.\nYour assist tool suggests: "${nba || "help within policy"}".\nCustomer just said: "${cust}".\nReply out loud to the customer. Output only your spoken reply.`;
      const rep = one(await askAsync(repPrompt, { timeout: 45000, tier: "fast" })).slice(0, 500);
      if (inRole(rep)) {
        convo.push({ who: "agent", text: rep });
        tr("rep-agent", "reply");
        emit({ kind: "turn", who: "agent", text: rep, sentiment: "neutral" });
      }
    } catch {
      /* skip */
    }
  }

  // SIMULATION vs a customer-twin
  emit({ kind: "thinking", who: "assist" });
  phase("Simulate");
  tr("simulation", "candidate strategies…");
  let chosen = null;
  try {
    const cands = await askJsonAsync(`The support agent must resolve this. Propose 3 REALISTIC strategies within agent authority (credit up to policy max, escalation, callback, monitoring, billing review). No fabricated SLAs/hardware. Call:\n${transcript()}\nReturn {"strategies":["<=12 words","",""]}`, { timeout: 45000, tier: "accurate" });
    const strategies = (cands.strategies || []).slice(0, 3);
    if (strategies.length) {
      const sim = await askJsonAsync(`${FRAME}\nYou ARE this customer. For each strategy estimate the probability 0-100 you would STAY. Strategies: ${JSON.stringify(strategies)}. Return {"results":[{"strategy":"<verbatim>","save":<int>}]}`, { timeout: 45000, tier: "accurate" });
      const results = (sim.results || []).map((r) => ({ strategy: r.strategy, save: Math.max(0, Math.min(100, Number(r.save) || 0)) })).sort((a, b) => b.save - a.save);
      if (results.length) {
        chosen = results[0];
        const lastConcern = [...graph.nodes].reverse().find((x) => x.type === "concern")?.id || "account";
        results.forEach((rr, si) => {
          const gid = `strat-${si}`;
          if (!graph.nodes.find((x) => x.id === gid)) graph.nodes.push({ id: gid, type: rr.strategy === chosen.strategy ? "chosen" : "strategy", label: rr.strategy.slice(0, 18) });
          graph.edges.push({ from: lastConcern, to: gid, rel: "weighs" });
        });
        const chosenId = `strat-${results.findIndex((rr) => rr.strategy === chosen.strategy)}`;
        trail.push(chosenId);
        emit({ kind: "graph", nodes: graph.nodes, edges: graph.edges, trail: [...trail] });
        // the customer-twin simulation, made visible as a node on the reasoning trail
        gnode({ id: "twin", type: "twin", label: `customer twin · ${chosen.save}%` }, chosenId, "validated by");
        tr("simulation", `${results.length} × customer-twin → best ${chosen.save}%`);
        emit({ kind: "assist", cat: "simulation", title: "Outcome simulation", body: `Simulated ${results.length} strategies against a model of this customer.`, branches: results, chosen: chosen.strategy });
      }
    }
  } catch {
    /* skip */
  }
  if (chosen) {
    emit({ kind: "thinking", who: "agent" });
    try {
      const applyPrompt = isAuto
        ? `${FRAME}\nYou are the autonomous AI agent for ${spec.meta.brand}. Apply this resolution now: "${chosen.strategy}". Tell the customer what you're doing — warm, natural, specific — ONE short sentence (≤20 words), contractions. Output only your spoken reply.`
        : `${FRAME}\nYou are ${spec.meta.agentName}, the ${spec.meta.brand} support agent, on a live call. Apply this resolution now: "${chosen.strategy}". Tell the customer what you're doing for them like a real human agent would — warm, natural, specific — ONE short sentence (≤20 words), contractions, take ownership. Output only your spoken reply.`;
      const rep = one(await askAsync(applyPrompt, { timeout: 45000, tier: "fast" })).slice(0, 500);
      if (inRole(rep)) {
        convo.push({ who: "agent", text: rep });
        emit({ kind: "turn", who: "agent", text: rep, sentiment: "positive" });
      }
    } catch {
      /* skip */
    }
  }

  // CLOSING — the customer reacts to what the agent just did (the real "user response", AI-generated).
  if (convo.length) {
    emit({ kind: "thinking", who: "customer" });
    try {
      const cr = await askJsonAsync(
        `${FRAME}\nYou are the CUSTOMER on the call to ${spec.meta.brand}. The agent just acted. React in ONE natural sentence — genuinely relieved/satisfied if they actually fixed the root issue or gave a fair offer; still wary or annoyed if they only deflected, stalled, or escalated without resolving. You don't know this is a simulation.\nConversation:\n${transcript()}\nReturn {"line":"<1 sentence, in character>","sentiment":"negative|neutral|positive"}`,
        { timeout: 40000, tier: "fast" }
      );
      const line = one(cr.line).slice(0, 400);
      if (inRole(line)) {
        convo.push({ who: "customer", text: line });
        const s = /negative|neutral|positive/.test(cr.sentiment || "") ? cr.sentiment : "neutral";
        emit({ kind: "turn", who: "customer", text: line, sentiment: s });
        emit({ kind: "sentiment", value: s });
      }
    } catch {
      /* skip */
    }
  }

  phase("Resolve");
  emit({ kind: "assist", cat: "compliance", title: "Compliance", body: "Recording disclosure stated · identity verified ✓" });
  tr("compliance", "disclosure + identity ✓");

  emit({ kind: "thinking", who: "assist" });
  try {
    const fin = await askJsonAsync(
      `Post-call resolution + QA for situation "${situation.title}". Transcript:\n${transcript()}\nChoose the BEST-FIT resolution for THIS situation (billing → refund/adjustment of the actual disputed amount; outage → prorated credit + status-page; upgrade → plan_change/offer; retention → loyalty_credit sized to THIS customer's tenure/value, a plan discount, or a service commitment). Resolve WITHIN your authority whenever the issue is addressable and prefer disposition "Resolved" or "Saved"; only escalate when it genuinely exceeds agent authority. Pick a realistic amount specific to this customer and issue — do NOT default to a fixed round number like $15. Return {"action":{"type":"refund|prorated_credit|plan_change|loyalty_credit|escalate|callback|none","amount":<int 0-200>,"detail":"<short specific>"},"score":<0-100>,"disposition":"Saved|Resolved|Lost|Escalated","summary":"<2 sentences>"}`,
      { timeout: 45000, tier: "accurate" }
    );
    const act = fin.action || { type: "none" };
    if (act.type && act.type !== "none") {
      const amt = Math.max(0, Math.min(500, Number(act.amount) || 0));
      const verb = `crm.${act.type}`;
      const label = amt > 0 ? `${act.type.replace(/_/g, " ")} $${amt}` : act.type.replace(/_/g, " ");
      const req = requestAction(ledger, { verb, args: { amount: amt } });
      emit({ kind: "assist", cat: "action", title: "Suggested action", body: `${label} — ${act.detail || ""}`, badge: req.decision });
      approve(ledger, req.entryIndex);
      tr("governance", `${verb}${amt ? " $" + amt : ""} · approved · audit#${ledger.audit.length}`);
      recordAudit({ actor: "agent", action: "governed.action", detail: `${verb}${amt ? " $" + amt : ""} · ${req.decision}→executed` });
      emit({ kind: "assist", cat: "action", title: "Action executed", body: `${act.detail || label} · audit logged`, badge: "done" });
      gnode({ id: "action", type: "action", label }, trail[trail.length - 1], "executes");
    }
    gnode({ id: "outcome", type: "outcome", label: fin.disposition || "—" }, graph.nodes.find((x) => x.id === "action") ? "action" : trail[trail.length - 1], "result");
    tr("qa-agent", `${fin.disposition || "—"} · score ${Number(fin.score) || 0}`);
    const won = ["Saved", "Resolved"].includes(fin.disposition);
    phase("Done");
    // LOOP CLOSED — write this live outcome back into the industry's brain graph as fresh evidence.
    try {
      const strat = mapActionToStrategy((fin.action && fin.action.type) || "");
      if (recordLiveOutcome(concern, strat, won)) tr("brain.feedback", `${concern} · ${strat} · ${won ? "win" : "miss"} → graph`);
    } catch {
      /* loop-back best-effort */
    }
    emit({ kind: "outcome", saveArr: won ? acct.mrr * 12 : 0, mrr: acct.mrr, qa: Number(fin.score) || 0, disposition: fin.disposition || "—", summary: fin.summary || "", concern });
    // write this run into demo memory so the intelligence layer can reason over it later
    try {
      recordRun({ title: situation.title, premise: situation.premise, starter, disposition: fin.disposition, qa: Number(fin.score) || 0, action: (fin.action && fin.action.type) || "" });
      recordAudit({ actor: "agent", action: "demo.run", detail: `${situation.title} → ${fin.disposition || "—"} · QA ${Number(fin.score) || 0}` });
    } catch {
      /* memory best-effort */
    }
    // LOOP 2 — independent customer-experience evaluator (NOT told this is a demo): a genuine
    // satisfaction score + blunt critique + one concrete system improvement. Feeds the active-feedback
    // self-improvement path (core/feedback.mjs) — distinct from the offline policy-training brain.
    try {
      emit({ kind: "thinking", who: "assist" });
      const cx = await askJsonAsync(
        `You are a senior customer-experience quality auditor at a ${spec.meta.domain} company, reviewing a real support call transcript. Judge ONLY the genuine quality from the customer's side: did the agent address the ROOT issue, show real empathy, resolve within policy, and would this customer actually be satisfied and stay? Be a tough but fair critic — give no credit for deflection or empty reassurance.\nTranscript:\n${transcript()}\nAgent's available knowledge/policy:\n${(spec.knowledge || []).map((k) => `${k.title}: ${k.text}`).join("\n").slice(0, 1500)}\nReturn {"score":<0-100 genuine customer satisfaction>,"satisfied":<true|false>,"critique":"<1-2 blunt sentences>","improvement":"<one concrete change to the agent's knowledge, policy or approach that would raise this>"}`,
        { timeout: 45000, tier: "accurate" }
      );
      const cxScore = Math.max(0, Math.min(100, Number(cx.score) || 0));
      const crit = String(cx.critique || "").slice(0, 240);
      const imp = String(cx.improvement || "").slice(0, 240);
      emit({ kind: "cxeval", score: cxScore, satisfied: !!cx.satisfied, critique: crit, improvement: imp });
      tr("cx-judge", `satisfaction ${cxScore}% · ${cx.satisfied ? "satisfied" : "not satisfied"}`);
      recordFeedback(spec.profile || "telecom", { concern, score: cxScore, satisfied: !!cx.satisfied, critique: crit, improvement: imp, disposition: fin.disposition });
    } catch {
      /* cx eval best-effort */
    }
  } catch {
    emit({ kind: "outcome", saveArr: 0, qa: 0, disposition: "—", summary: "QA agent unavailable." });
  }
  emit({ kind: "thinking", who: null });
}
