// The self-improvement loop: Produce → Critique → Queue → Propose → Execute → Verify → Learn.
// A fix is only banked if the SAME critic that scored the gap shows the score rose (else revert).
// Emits a PanelSpec stream of the stages; deterministic for stage.
import { repair } from "./renderer.mjs";
import { critique } from "./critic.mjs";
import { createQueue, enqueue, ranked, resolve } from "./queue.mjs";
import { ask, askJson } from "./llm.mjs";

// The artifact under improvement: required capabilities of a demo. Starts incomplete.
export const REQUIREMENTS = [
  { key: "citation", dim: "correctness", label: "Grounded citation", severity: "high" },
  { key: "governedAction", dim: "correctness", label: "Governed agentic action", severity: "high" },
  { key: "compliance", dim: "completeness", label: "Compliance check", severity: "med" },
  { key: "analytics", dim: "completeness", label: "Post-call analytics", severity: "med" },
  { key: "ordering", dim: "coherence", label: "Coherent event ordering", severity: "low" },
];

export function runImprovementLoop(opts = {}) {
  const guard = opts.maxIterations ?? 12;
  const present = { compliance: true }; // an early, incomplete demo
  const queue = createQueue();
  const learned = [];
  const events = [];
  const push = (p) => events.push(repair(p));

  let iter = 0;
  let crit = critique(REQUIREMENTS, present);
  push({ type: "metric", label: "Initial quality", value: crit.score, unit: "%" });

  while (crit.gaps.length && iter < guard) {
    push({ type: "step", label: `PRODUCE → CRITIQUE — score ${crit.score}%, ${crit.gaps.length} gap(s)`, status: "done" });

    // QUEUE: enqueue every gap, de-duped (repeat gaps bump frequency).
    for (const g of crit.gaps) enqueue(queue, { key: g.key, source: "critic", severity: g.severity, label: g.label });

    const top = ranked(queue)[0];
    if (!top) break;

    // PROPOSE + EXECUTE: apply the smallest fix for the top-ranked gap (in isolation).
    push({ type: "step", label: `PROPOSE + EXECUTE — ${top.label}`, status: "active" });
    const before = crit.score;
    present[top.key] = true;

    // VERIFY: re-run the same critic; only bank the fix if the score improved.
    crit = critique(REQUIREMENTS, present);
    if (crit.score > before) {
      resolve(queue, top.key);
      learned.push(top.key); // LEARN
      push({ type: "note", kind: "success", title: "Verified", body: `${top.label} ✓  (${before}% → ${crit.score}%)` });
    } else {
      present[top.key] = false; // auto-revert
      push({ type: "note", kind: "error", title: "Reverted", body: `${top.label} did not improve the score — reverted.` });
    }
    iter++;
  }

  push({ type: "metric", label: "Final quality", value: crit.score, unit: "%" });
  push({
    type: "note",
    kind: crit.gaps.length === 0 ? "success" : "warn",
    title: crit.gaps.length === 0 ? "Converged" : "Budget reached",
    body: `Learned ${learned.length} fix(es) across ${iter} iteration(s), each gated by the critic.`,
  });

  return { events, finalScore: crit.score, converged: crit.gaps.length === 0, iterations: iter, learned, queue: queue.items.slice() };
}

// LIVE variant: Claude actually critiques and rewrites a real artifact, gated by its own
// score, until it clears the bar. Real improvement of real text — not flag-flipping.
export function runLiveImprovement(opts = {}) {
  const target = opts.target ?? 88;
  const maxRounds = opts.maxRounds ?? 2;
  let text = opts.seed || "Our AI helps call centers do better.";
  const events = [];
  const push = (p) => events.push(repair(p));
  let score = 0;
  let round = 0;

  push({ type: "note", kind: "info", title: "Self-improvement (live)", body: "Claude critiques and rewrites a real artifact until it clears the bar." });
  push({ type: "doc", title: "Draft v0", body: text });

  while (round < maxRounds) {
    let crit;
    try {
      crit = askJson(
        `Score this product tagline 0-100 on clarity, specificity, and impact, and list concrete gaps. ` +
          `Tagline: "${text}". JSON: {"score": <int>, "gaps": ["..."]}`,
        { timeout: 60000 }
      );
    } catch {
      break;
    }
    score = Number(crit.score) || 0;
    const gaps = Array.isArray(crit.gaps) ? crit.gaps.slice(0, 4) : [];
    push({ type: "metric", label: `Critic score (round ${round + 1})`, value: score, unit: "%" });
    if (gaps.length) push({ type: "plan", title: "Gaps", steps: gaps });
    if (score >= target || !gaps.length) break;
    let rewritten;
    try {
      rewritten = ask(
        `Rewrite this product tagline to fix these gaps: ${gaps.join("; ")}. ` +
          `Tagline: "${text}". Output ONLY the improved tagline on one line.`,
        { timeout: 60000 }
      )
        .split("\n")[0]
        .replace(/^["']|["']$/g, "")
        .slice(0, 160);
    } catch {
      break;
    }
    text = rewritten;
    round++;
    push({ type: "doc", title: `Draft v${round}`, body: text });
  }

  push({
    type: "note",
    kind: score >= target ? "success" : "warn",
    title: score >= target ? "Cleared the bar" : "Best effort",
    body: `Final score ${score}% after ${round} live rewrite(s), each gated by the critic.`,
  });
  return { events, finalScore: score, converged: score >= target, rounds: round };
}
