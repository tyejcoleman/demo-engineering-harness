// THE BRAIN — a self-evolving context graph as the source of truth, plus a decision policy that
// sits ABOVE the graph, plus a JUDGE LLM that does meta self-improvement. The graph accumulates
// outcome evidence across cases (its weighted edges ARE the memory + audit trail); a fast learning
// loop tunes the policy from that evidence; then a second LLM reviews the whole graph and proposes
// the optimized policy + improvements. "Developing a brain": watch customer-success climb as it learns.
//
// PER-INDUSTRY: every profile has its OWN concern taxonomy, strategy set, hidden success model, and a
// rare high-stakes concern the online learner under-samples (the cold-start gap the judge closes).
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { askJsonAsync } from "./llm.mjs";
import { loadSpec } from "./spec.mjs";

// Each profile keeps its own learned graph/policy file, so switching industry shows that brain.
const storePath = () => process.env.FORGE_BRAIN || path.join(process.cwd(), "data", `brain-${loadSpec().profile || "telecom"}.json`);

// Hidden ground truth per industry: the real customer-success rate of each strategy per concern. The
// brain does NOT see this — it learns it from observed outcomes. `rare` = a high-stakes, low-frequency
// concern the online loop barely sees, so its data-only pick is shaky; the judge fixes it offline.
const DOMAINS = {
  telecom: {
    rare: "fraud",
    seed: {
      billing: { refund: 0.92, credit: 0.7, escalate: 0.45, callback: 0.4, plan_change: 0.3, discount: 0.48, monitor: 0.25 },
      outage: { credit: 0.86, monitor: 0.62, escalate: 0.7, callback: 0.5, refund: 0.55, discount: 0.5, plan_change: 0.3 },
      retention: { discount: 0.82, credit: 0.66, plan_change: 0.72, callback: 0.45, refund: 0.5, escalate: 0.4, monitor: 0.35 },
      fraud: { escalate: 0.9, callback: 0.62, refund: 0.55, credit: 0.35, monitor: 0.5, discount: 0.2, plan_change: 0.2 },
      upgrade: { plan_change: 0.88, discount: 0.62, credit: 0.4, callback: 0.45, refund: 0.25, escalate: 0.3, monitor: 0.3 },
    },
  },
  fintech: {
    rare: "fraud_alert",
    seed: {
      disputed_charge: { refund: 0.9, reverse_fee: 0.6, escalate: 0.5, verify_id: 0.45, callback: 0.4, offer_plan: 0.3, freeze_account: 0.35 },
      account_locked: { verify_id: 0.88, escalate: 0.6, callback: 0.55, freeze_account: 0.4, reverse_fee: 0.3, refund: 0.3, offer_plan: 0.35 },
      loan_inquiry: { offer_plan: 0.85, callback: 0.5, verify_id: 0.45, escalate: 0.4, reverse_fee: 0.3, refund: 0.25, freeze_account: 0.2 },
      fraud_alert: { freeze_account: 0.92, escalate: 0.8, verify_id: 0.6, callback: 0.5, refund: 0.4, reverse_fee: 0.25, offer_plan: 0.2 },
      fee_waiver: { reverse_fee: 0.86, refund: 0.6, offer_plan: 0.5, callback: 0.45, escalate: 0.4, verify_id: 0.35, freeze_account: 0.2 },
    },
  },
  travel: {
    rare: "medical",
    seed: {
      cancellation: { rebook: 0.84, refund: 0.78, voucher: 0.6, compensate: 0.5, escalate: 0.45, callback: 0.4, upgrade_seat: 0.3 },
      delay: { compensate: 0.85, voucher: 0.66, rebook: 0.6, upgrade_seat: 0.55, refund: 0.5, callback: 0.4, escalate: 0.4 },
      rebooking: { rebook: 0.9, upgrade_seat: 0.6, voucher: 0.5, compensate: 0.45, refund: 0.4, callback: 0.4, escalate: 0.35 },
      baggage: { compensate: 0.82, voucher: 0.64, refund: 0.55, escalate: 0.5, callback: 0.45, rebook: 0.4, upgrade_seat: 0.3 },
      medical: { escalate: 0.93, compensate: 0.6, rebook: 0.55, callback: 0.5, refund: 0.4, voucher: 0.3, upgrade_seat: 0.25 },
    },
  },
  retail: {
    rare: "chargeback",
    seed: {
      return: { refund: 0.88, store_credit: 0.7, replace: 0.55, discount: 0.5, reship: 0.4, callback: 0.4, escalate: 0.35 },
      damaged: { replace: 0.9, refund: 0.7, reship: 0.6, store_credit: 0.55, discount: 0.45, callback: 0.4, escalate: 0.4 },
      missing_order: { reship: 0.87, refund: 0.68, replace: 0.6, escalate: 0.5, store_credit: 0.5, callback: 0.45, discount: 0.3 },
      chargeback: { escalate: 0.9, refund: 0.6, callback: 0.55, replace: 0.4, store_credit: 0.35, reship: 0.3, discount: 0.2 },
      loyalty: { discount: 0.84, store_credit: 0.72, refund: 0.45, callback: 0.45, replace: 0.4, escalate: 0.3, reship: 0.3 },
    },
  },
  healthcare: {
    rare: "clinical_urgent",
    seed: {
      claim_denied: { appeal: 0.85, prior_auth: 0.8, escalate: 0.55, expedite: 0.5, callback: 0.45, refund: 0.4, reschedule: 0.3 },
      rx_delay: { expedite: 0.88, prior_auth: 0.66, escalate: 0.6, callback: 0.5, appeal: 0.4, reschedule: 0.35, refund: 0.3 },
      appointment: { reschedule: 0.86, expedite: 0.6, callback: 0.55, escalate: 0.45, prior_auth: 0.3, appeal: 0.3, refund: 0.25 },
      billing_error: { refund: 0.9, appeal: 0.6, escalate: 0.5, callback: 0.5, prior_auth: 0.4, expedite: 0.4, reschedule: 0.3 },
      clinical_urgent: { escalate: 0.94, expedite: 0.7, callback: 0.55, prior_auth: 0.5, appeal: 0.4, reschedule: 0.3, refund: 0.2 },
    },
  },
};

// The REWARD MODEL ("efficacy") is derived once per industry by an LLM from that industry's real
// knowledge base and cached — so the outcomes the brain learns from come from real domain reasoning,
// not a hand-coded table. The `seed` matrix below is only an offline fallback if the LLM is unavailable.
const efficacyPath = (p) => path.join(process.cwd(), "data", `efficacy-${p || loadSpec().profile || "telecom"}.json`);
function loadEfficacy(p) {
  try {
    return JSON.parse(fs.readFileSync(efficacyPath(p), "utf8"));
  } catch {
    return null;
  }
}

// Resolve the active industry's domain. truth = the LLM-grounded reward model if derived, else the seed.
function domain() {
  const prof = loadSpec().profile || "telecom";
  const d = DOMAINS[prof] || DOMAINS.telecom;
  const concerns = Object.keys(d.seed);
  const strategies = [...new Set(concerns.flatMap((c) => Object.keys(d.seed[c])))];
  const truth = loadEfficacy(prof) || d.seed;
  return { concerns, strategies, truth, rare: d.rare, profile: prof };
}

// Derive (and cache) the per-industry reward model from the live knowledge base via an LLM. Idempotent:
// returns the cache if present. This is what makes the learning environment real + dynamic per industry.
export async function ensureEfficacy(emit) {
  const prof = loadSpec().profile || "telecom";
  const cached = loadEfficacy(prof);
  if (cached) return cached;
  const d = DOMAINS[prof] || DOMAINS.telecom;
  const concerns = Object.keys(d.seed);
  const strategies = [...new Set(concerns.flatMap((c) => Object.keys(d.seed[c])))];
  const spec = loadSpec();
  const kb = (spec.knowledge || []).map((k) => `- ${k.title}: ${k.text}`).join("\n").slice(0, 4000);
  if (emit) emit({ deriving: true });
  let matrix = null;
  try {
    const out = await askJsonAsync(
      `You are a senior ${spec.meta.domain} operations expert. Using ONLY this knowledge base and real domain best practice, estimate how effective each RESOLUTION STRATEGY is at actually resolving each CONCERN — as the probability (0-100) that the strategy resolves it and keeps the customer.\nKnowledge base:\n${kb}\nConcerns: ${JSON.stringify(concerns)}\nStrategies: ${JSON.stringify(strategies)}\nReturn STRICT JSON {"<concern>": {"<strategy>": <0-100>, ...}, ...} covering every concern and every strategy. Make the differences realistic — the best strategy per concern should clearly win; high-stakes concerns (e.g. fraud/medical/urgent) should favor escalation.`,
      { timeout: 60000, tier: "accurate" }
    );
    matrix = {};
    for (const c of concerns) {
      matrix[c] = {};
      for (const s of strategies) {
        const v = Number(out?.[c]?.[s]);
        matrix[c][s] = Number.isFinite(v) ? Math.max(0.05, Math.min(0.98, v / 100)) : d.seed[c]?.[s] ?? 0.3;
      }
    }
  } catch {
    matrix = d.seed; // graceful offline fallback
  }
  try {
    fs.mkdirSync(path.dirname(efficacyPath(prof)), { recursive: true });
    fs.writeFileSync(efficacyPath(prof), JSON.stringify(matrix));
  } catch {
    /* in-memory only */
  }
  if (emit) emit({ deriving: false, source: matrix === d.seed ? "seed-fallback" : "kb-llm" });
  return matrix;
}

// Backward-compatible exports (telecom defaults).
export const CONCERNS = Object.keys(DOMAINS.telecom.seed);
export const STRATEGIES = [...new Set(CONCERNS.flatMap((c) => Object.keys(DOMAINS.telecom.seed[c])))];

// How often each concern shows up in the live case stream — the rare concern is heavily under-sampled.
function pickConcern(d) {
  const weight = (c) => (c === d.rare ? 0.05 : 1);
  const total = d.concerns.reduce((s, c) => s + weight(c), 0);
  let r = Math.random() * total;
  for (const c of d.concerns) {
    r -= weight(c);
    if (r <= 0) return c;
  }
  return d.concerns[0];
}

function blank() {
  return { graph: { nodes: [], edges: [] }, observed: {}, policy: {}, history: [], rounds: 0, judge: null, stage: "untrained", distilled: null, validation: null };
}
function read() {
  try {
    return JSON.parse(fs.readFileSync(storePath(), "utf8"));
  } catch {
    return blank();
  }
}
function write(d) {
  const p = storePath();
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(d, null, 2));
  } catch {
    try {
      fs.writeFileSync(path.join(os.tmpdir(), path.basename(p)), JSON.stringify(d));
    } catch {
      /* in-memory */
    }
  }
}

function successRate(policy, d = domain()) {
  let s = 0;
  let n = 0;
  for (const c of d.concerns) {
    const st = policy[c];
    if (st) {
      s += d.truth[c]?.[st] ?? 0.3;
      n++;
    }
  }
  return n ? Math.round((100 * s) / n) : 0;
}

// Render the accumulated brain as a context graph (source of truth): concern → strategy → outcome,
// weighted by evidence. The policy-chosen "good" paths form the lit trail.
function renderGraph(brain, d = domain()) {
  const nodes = [];
  const edges = [];
  const seen = new Set();
  const add = (id, type, label) => {
    if (!seen.has(id)) {
      seen.add(id);
      nodes.push({ id, type, label });
    }
  };
  add("o:good", "outcome", "resolved ✓");
  add("o:bad", "concern", "unresolved");
  const trail = ["o:good"];
  for (const c of d.concerns) {
    const obs = brain.observed[c];
    if (!obs) continue;
    add("c:" + c, "concern", c);
    trail.push("c:" + c);
    for (const s of Object.keys(obs)) {
      const o = obs[s];
      add("s:" + c + ":" + s, brain.policy[c] === s ? "chosen" : "strategy", s);
      edges.push({ from: "c:" + c, to: "s:" + c + ":" + s, rel: `${Math.round((100 * o.wins) / o.n)}%` });
      edges.push({ from: "s:" + c + ":" + s, to: o.wins / o.n >= 0.5 ? "o:good" : "o:bad", rel: "→" });
      if (brain.policy[c] === s) trail.push("s:" + c + ":" + s);
    }
  }
  return { nodes, edges, trail };
}

export function getBrain() {
  const b = read();
  const d = domain();
  return {
    graph: renderGraph(b, d),
    policy: b.policy,
    history: b.history,
    rounds: b.rounds,
    judge: b.judge,
    stage: b.stage || "untrained",
    distilled: b.distilled || null,
    validation: b.validation || null,
    concerns: d.concerns,
    rare: d.rare,
    nodes: renderGraph(b, d).nodes.length,
    success: b.history.length ? b.history[b.history.length - 1].success : 0,
  };
}

export function resetBrain() {
  write(blank());
  return getBrain();
}

// Wipe EVERY industry's brain (used at session start so no training leaks between visitors).
export function resetAllBrains() {
  try {
    const dir = path.join(process.cwd(), "data");
    for (const f of fs.readdirSync(dir)) if (/^brain-.*\.json$/.test(f)) fs.rmSync(path.join(dir, f), { force: true });
  } catch {
    /* nothing to clear */
  }
}

// FRESH untrained baseline — the honest "prior to any training" answer. Recomputed every call (Monte-
// Carlo over random strategy choices), so it is never cached and never reflects prior training.
export function baselineScore(samples = 400) {
  const d = domain();
  let w = 0;
  let n = 0;
  for (let i = 0; i < samples; i++) {
    const c = d.concerns[Math.floor(Math.random() * d.concerns.length)];
    const s = d.strategies[Math.floor(Math.random() * d.strategies.length)]; // untrained = no policy → random
    n++;
    if (Math.random() < (d.truth[c]?.[s] ?? 0.3)) w++;
  }
  return n ? Math.round((100 * w) / n) : 0;
}

// One training pass: simulate cases under the current policy (with epsilon exploration so the brain
// keeps discovering), record outcomes into the graph, then re-derive the policy from the evidence.
export function trainRounds(rounds = 8, casesPerRound = 160, emit) {
  const brain = read();
  const d = domain();
  for (let r = 0; r < rounds; r++) {
    const epsilon = Math.max(0.05, 0.7 - brain.rounds * 0.07);
    let roundWins = 0;
    for (let c = 0; c < casesPerRound; c++) {
      const concern = pickConcern(d);
      const explore = Math.random() < epsilon || !brain.policy[concern];
      const strat = explore ? d.strategies[Math.floor(Math.random() * d.strategies.length)] : brain.policy[concern];
      const win = Math.random() < (d.truth[concern]?.[strat] ?? 0.3);
      if (win) roundWins++;
      brain.observed[concern] = brain.observed[concern] || {};
      const o = (brain.observed[concern][strat] = brain.observed[concern][strat] || { n: 0, wins: 0 });
      o.n++;
      if (win) o.wins++;
    }
    // re-derive policy: best evidence-weighted mean per concern (confidence-discounted)
    for (const concern of d.concerns) {
      const stats = brain.observed[concern] || {};
      let best = brain.policy[concern] || null;
      let bv = -1;
      for (const s of d.strategies) {
        const st = stats[s];
        const mean = st ? st.wins / st.n : 0;
        const conf = st ? st.n : 0;
        // mild confidence discount: training picks the best well-evidenced strategy. On rich concerns
        // it converges to optimal; on the RARE concern it lacks data, so its pick is shaky — that's the
        // gap the judge closes with offline counterfactual evaluation.
        const score = mean * (conf / (conf + 4));
        if (score > bv) {
          bv = score;
          best = s;
        }
      }
      if (best) brain.policy[concern] = best;
    }
    brain.rounds++;
    // plot the ACTUAL win-rate this round (early rounds explore → lower; later exploit the learned
    // policy → higher), so the curve shows real learning instead of jumping to the optimum.
    const success = Math.round((100 * roundWins) / casesPerRound);
    const g = renderGraph(brain, d);
    brain.history.push({ round: brain.rounds, success, nodes: g.nodes.length, edges: g.edges.length });
    if (emit) emit({ round: brain.rounds, success, nodes: g.nodes.length, edges: g.edges.length, epsilon: Math.round(epsilon * 100) });
  }
  if (brain.stage === "untrained" || !brain.stage) brain.stage = "trained";
  write(brain);
  return getBrain();
}

// Meta self-improvement: a JUDGE LLM reviews the accumulated context graph and (via offline
// counterfactual evaluation) proposes the optimal policy + concrete improvements above the graph.
export async function judgeBrain() {
  const brain = read();
  const spec = loadSpec();
  const d = domain();
  const stats = d.concerns.map((c) => ({
    concern: c,
    evidence: Object.entries(brain.observed[c] || {})
      .map(([s, o]) => ({ strategy: s, success: Math.round((100 * o.wins) / o.n), cases: o.n }))
      .sort((a, b) => b.success - a.success),
  }));
  const before = successRate(brain.policy, d);

  // OFFLINE COUNTERFACTUAL EVALUATION: online training exploits (it can't afford to keep testing
  // every strategy, and the rare concern barely appears). The judge has no such constraint — it
  // re-rolls every strategy for every concern with fresh cases and sets the policy from what actually
  // performs best. This is the real online-vs-offline gap, and it reliably finds the optimum.
  const swept = { ...brain.policy };
  const changed = [];
  for (const c of d.concerns) {
    let best = null;
    let bv = -1;
    for (const s of d.strategies) {
      let w = 0;
      const N = 600;
      for (let i = 0; i < N; i++) if (Math.random() < (d.truth[c]?.[s] ?? 0.3)) w++;
      if (w / N > bv) {
        bv = w / N;
        best = s;
      }
    }
    if (best && best !== brain.policy[c]) changed.push({ concern: c, from: brain.policy[c] || "—", to: best });
    if (best) swept[c] = best;
  }

  let result;
  try {
    result = await askJsonAsync(
      `You are the JUDGE LLM doing meta self-improvement of a ${spec.meta.domain} customer-service "brain". The online learner produced this policy: ${JSON.stringify(brain.policy)}, from this observed evidence (success% per strategy per concern): ${JSON.stringify(stats)}.\nYou then ran OFFLINE counterfactual rollouts (re-testing every strategy, including the rare "${d.rare}" concern the live loop under-sampled) and corrected these: ${changed.length ? JSON.stringify(changed) : "none — the online policy was already optimal"}.\nWrite a 2-sentence rationale explaining what the counterfactual evaluation found (call out the rare/under-sampled concern it corrected), and propose 2 concrete improvements to the algorithms or interfaces sitting ABOVE the context-graph layer. JSON: {"rationale":"<2 sentences>","improvements":["",""]}`,
      { timeout: 60000 }
    );
  } catch {
    result = {
      rationale: changed.length
        ? `Offline counterfactual rollouts corrected ${changed.map((x) => `${x.concern}: ${x.from}→${x.to}`).join(", ")} — concerns the online loop under-sampled. Rich concerns were confirmed.`
        : "Counterfactual rollouts confirmed every concern — the online policy was already optimal.",
      improvements: [],
    };
  }
  // apply the counterfactually-verified policy (reliable optimum), not a re-guess from thin data
  const applied = swept;
  brain.policy = applied;
  const after = successRate(applied, d);
  brain.judge = { rationale: String(result.rationale || "").slice(0, 400), improvements: (result.improvements || []).slice(0, 3).map((x) => String(x).slice(0, 160)), changed, before, after, at: new Date().toISOString() };
  brain.history.push({ round: brain.rounds, success: after, nodes: renderGraph(brain, d).nodes.length, edges: renderGraph(brain, d).edges.length, judge: true });
  write(brain);
  return { before, after, judge: brain.judge, brain: getBrain() };
}

// DISTILL — extract the learned decision process into a portable artifact, with NO raw training data.
export function distill() {
  const b = read();
  const d = domain();
  const rules = d.concerns.filter((c) => b.policy[c]).map((c) => {
    const o = (b.observed[c] || {})[b.policy[c]];
    return { concern: c, strategy: b.policy[c], confidence: o ? Math.round((100 * o.wins) / o.n) : null, cases: o ? o.n : 0 };
  });
  const trainedSuccess = b.history.length ? b.history[b.history.length - 1].success : 0;
  const artifact = {
    kind: "forge-brain",
    version: (b.distilled?.version || 0) + 1,
    distilledAt: new Date().toISOString(),
    trainedSuccess,
    policy: b.policy,
    rules,
    metaImprovements: b.judge?.improvements || [],
    note: "Portable decision process — NO training/seed data included. Point it at live client data.",
  };
  b.distilled = artifact;
  b.stage = "distilled";
  // drop the seed data points from the context graph — keep ONLY the extracted process.
  b.observed = {};
  b.graph = { nodes: [], edges: [] };
  write(b);
  return artifact;
}

// VALIDATE — run the current/distilled policy on a FRESH, unseen sample vs an untrained baseline, to
// prove it generalizes (not memorized). Works after training or after distill. Each case is a real
// Monte-Carlo draw against the hidden truth — that's why two runs differ. `emit` streams live progress.
export function validate(samples = 500, emit) {
  const b = read();
  const d = domain();
  const policy = b.distilled?.policy || b.policy;
  if (!Object.keys(policy).length) return { error: "train the brain first" };
  const per = {};
  let baseWins = 0;
  let baseN = 0;
  let w = 0;
  let n = 0;
  b.observed = b.observed || {};
  const trial = () => {
    const concern = d.concerns[Math.floor(Math.random() * d.concerns.length)];
    const strat = policy[concern];
    if (!strat) return;
    const win = Math.random() < (d.truth[concern]?.[strat] ?? 0.3);
    per[concern] = per[concern] || { n: 0, wins: 0 };
    per[concern].n++;
    n++;
    if (win) {
      per[concern].wins++;
      w++;
    }
    // refill the context graph with this live/new data point
    b.observed[concern] = b.observed[concern] || {};
    const o = (b.observed[concern][strat] = b.observed[concern][strat] || { n: 0, wins: 0 });
    o.n++;
    if (win) o.wins++;
    // baseline control: an UNTRAINED agent (random strategy) on an equivalent new case
    const rb = d.strategies[Math.floor(Math.random() * d.strategies.length)];
    baseN++;
    if (Math.random() < (d.truth[concern]?.[rb] ?? 0.3)) baseWins++;
  };
  // Run in batches so the test can stream (graph refills + running rate climbs) instead of snapping.
  const batches = emit ? 12 : 1;
  const perBatch = Math.ceil(samples / batches);
  let done = 0;
  for (let bi = 0; bi < batches && done < samples; bi++) {
    const upto = Math.min(samples, done + perBatch);
    for (; done < upto; done++) trial();
    if (emit) {
      b.validation = { success: n ? Math.round((100 * w) / n) : 0, baseline: baseN ? Math.round((100 * baseWins) / baseN) : 0, samples: n, partial: done < samples };
      write(b);
      emit({ done, total: samples, success: b.validation.success, baseline: b.validation.baseline });
    }
  }
  const perConcern = d.concerns.filter((c) => per[c]).map((c) => ({ concern: c, strategy: policy[c], success: Math.round((100 * per[c].wins) / per[c].n), cases: per[c].n }));
  const trainedSuccess = b.distilled?.trainedSuccess ?? (b.history.length ? b.history[b.history.length - 1].success : 0);
  b.validation = {
    success: n ? Math.round((100 * w) / n) : 0,
    baseline: baseN ? Math.round((100 * baseWins) / baseN) : 0,
    samples: n,
    trainedSuccess,
    perConcern,
    at: new Date().toISOString(),
  };
  b.stage = "validated";
  write(b);
  return b.validation;
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
// CLOSE THE LOOP — the live demo consults the learned brain, and live outcomes feed back into it.

const CONCERN_KEYS = {
  billing: ["bill", "charge", "overpay", "invoice", "price", "fee", "refund"],
  outage: ["outage", "down", "drop", "slow", "internet", "signal", "connection", "service"],
  retention: ["cancel", "leave", "switch", "competitor", "churn", "quit", "ready to cancel"],
  fraud: ["fraud", "unauthorized", "scam", "stolen", "suspicious", "hack"],
  upgrade: ["upgrade", "faster", "more data", "streaming", "tier", "plan can't"],
  disputed_charge: ["dispute", "charge", "transaction", "didn't authorize", "unauthorized charge"],
  account_locked: ["locked", "can't log", "access", "frozen", "login", "lock"],
  loan_inquiry: ["loan", "mortgage", "borrow", "apply", "credit line"],
  fraud_alert: ["fraud", "suspicious", "scam", "stolen", "unauthorized"],
  fee_waiver: ["fee", "overdraft", "waive", "penalty"],
  cancellation: ["cancel", "cancelled", "called off"],
  delay: ["delay", "delayed", "late", "stuck"],
  rebooking: ["rebook", "change flight", "different flight", "next flight"],
  baggage: ["baggage", "luggage", "bag", "suitcase"],
  medical: ["medical", "sick", "emergency", "ill", "wheelchair", "assistance"],
  return: ["return", "send back", "return item"],
  damaged: ["damaged", "broken", "defective", "cracked"],
  missing_order: ["missing", "didn't arrive", "never came", "lost package", "where is"],
  chargeback: ["chargeback", "fraud", "dispute"],
  loyalty: ["loyalty", "points", "rewards", "member", "vip"],
  claim_denied: ["claim", "denied", "coverage", "not covered"],
  rx_delay: ["prescription", "refill", "medication", "rx", "pharmacy", "insulin"],
  appointment: ["appointment", "schedule", "reschedule", "booking", "visit"],
  billing_error: ["bill", "charge", "invoice", "overcharged"],
  clinical_urgent: ["urgent", "emergency", "pain", "critical", "severe", "now"],
};

// Map free customer text to the active domain's closest concern (keyword vote, first-concern fallback).
export function classifyConcern(text) {
  const d = domain();
  const t = String(text || "").toLowerCase();
  let best = d.concerns[0];
  let score = 0;
  for (const c of d.concerns) {
    // the canonical (first) keyword is the decisive intent signal — weight it higher so e.g. "cancel"
    // (retention) beats an incidental "price" mention (billing) on a retention call.
    const s = (CONCERN_KEYS[c] || []).reduce((acc, k, i) => acc + (t.includes(k) ? (i === 0 ? 3 : 1) : 0), 0);
    if (s > score) {
      score = s;
      best = c;
    }
  }
  return best;
}

// What the trained brain recommends for a concern (with learned confidence), or null if untrained.
export function policyFor(concern) {
  const b = read();
  const strat = b.policy[concern];
  if (!strat) return null;
  const o = (b.observed[concern] || {})[strat];
  return { concern, strategy: strat, confidence: o ? Math.round((100 * o.wins) / o.n) : null, cases: o ? o.n : 0, trained: !!b.history.length };
}

// Before vs after self-learning for ONE concern: an untrained agent (random) vs the trained policy.
export function compareConcern(concern) {
  const d = domain();
  const b = read();
  const truth = d.truth[concern] || {};
  const trainedStrat = b.policy[concern] || null;
  const vals = d.strategies.map((s) => truth[s] ?? 0.3);
  const untrained = Math.round((100 * vals.reduce((a, c) => a + c, 0)) / vals.length);
  const best = Math.max(...vals);
  return {
    concern,
    trainedStrat,
    untrained,
    trained: trainedStrat ? Math.round(100 * (truth[trainedStrat] ?? 0.3)) : null,
    optimal: Math.round(100 * best),
  };
}

// Map a live governed action type to this domain's strategy vocabulary (for loop-back recording).
export function mapActionToStrategy(actionType) {
  const d = domain();
  const t = String(actionType || "").toLowerCase();
  if (d.strategies.includes(t)) return t;
  const MAP = { prorated_credit: "credit", loyalty_credit: "discount", plan_change: "plan_change", refund: "refund", escalate: "escalate", callback: "callback", reverse_fee: "reverse_fee", store_credit: "store_credit" };
  const m = MAP[t];
  if (m && d.strategies.includes(m)) return m;
  return d.strategies.find((x) => t.includes(x) || x.includes(t)) || null;
}

// Record a live call outcome back into the brain graph — this is the loop closing.
export function recordLiveOutcome(concern, strategy, won) {
  const d = domain();
  if (!d.concerns.includes(concern) || !strategy) return false;
  const b = read();
  b.observed[concern] = b.observed[concern] || {};
  const o = (b.observed[concern][strategy] = b.observed[concern][strategy] || { n: 0, wins: 0 });
  o.n++;
  if (won) o.wins++;
  if (b.stage === "untrained") b.stage = "live-fed";
  write(b);
  return true;
}
