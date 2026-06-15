// Live Copilot pipeline (Demo B). Seeded + deterministic for stage; live LLM/MCP calls
// drop in behind the same shape. Produces a stream of PanelSpec events plus a structured
// result: grounded coaching with a verbatim citation + a governed, audited agentic action.
import { repair } from "./renderer.mjs";
import { retrieve, KB } from "./kb.mjs";
import { createLedger, requestAction, approve, auditTrail } from "./governance.mjs";
import { crmTools } from "./mcp-crm.mjs";
import { ask } from "./llm.mjs";

export const SCENARIO = {
  id: "acme-retention",
  accountId: "acme-tanaka",
  turns: [
    { who: "customer", text: "I want to cancel, I'm done with the outages.", intent: "cancel", sentiment: "negative" },
    { who: "agent", text: "I'm sorry to hear that — let me see what I can do.", intent: "deescalate", sentiment: "neutral" },
    { who: "customer", text: "It's been unreliable and I'm paying a lot.", intent: "price_complaint", sentiment: "negative" },
  ],
};

export function runCopilot(opts = {}) {
  const scenario = opts.scenario || SCENARIO;
  const autoApprove = opts.autoApprove !== false; // seeded/stage default
  const live = opts.live === true; // real Claude coaching/summary when set
  const ledger = createLedger();
  const events = [];
  const push = (p) => events.push(repair(p));

  push({ type: "note", kind: "info", title: "Live Copilot", body: `Call connected — account ${scenario.accountId}.` });

  // 1. Pull CRM context via the (mock) MCP tool — a governed read.
  requestAction(ledger, { verb: "crm.read", what: "Read account + open tickets" });
  const account = crmTools.getAccount({ id: scenario.accountId });
  const tickets = crmTools.getTickets({ id: scenario.accountId });
  push({
    type: "card",
    title: "CRM (via MCP)",
    badge: "crm.read",
    body: `${account.name} · ${account.plan} · $${account.mrr}/mo · tenure ${account.tenureMonths}mo · ${tickets.length} open tickets`,
  });

  // 2. Stream turns with live intent + sentiment.
  for (const t of scenario.turns) {
    push({ type: "step", label: `${t.who}: "${t.text}" — ${t.intent}/${t.sentiment}`, status: "done" });
  }

  // 3. RAG-grounded coaching with a verbatim citation.
  const query = scenario.turns.map((t) => t.text).join(" ") + " retention loyalty credit churn";
  const [src] = retrieve(query, 1);
  let citation = null;
  if (src) {
    citation = { source: src.id, quote: src.text };
    push({ type: "citation", source: src.id, quote: src.text });
    let coaching =
      "Acknowledge the outage frustration, then offer a loyalty retention credit (grounded in the policy above).";
    if (live) {
      try {
        coaching = ask(
          `Telecom support call. Turns: ${scenario.turns.map((t) => t.who + ": " + t.text).join(" | ")}. ` +
            `Grounding policy ${src.id}: "${src.text}". ` +
            `Write ONE concise next-best-action sentence for the agent, grounded strictly in that policy. No preamble.`,
          { timeout: 60000 }
        )
          .split("\n")[0]
          .slice(0, 240);
      } catch {
        /* keep seeded coaching */
      }
    }
    push({ type: "card", title: "Next best action", badge: live ? "grounded · live" : "grounded", body: coaching });
  }

  // 4. Compliance check.
  push({ type: "note", kind: "warn", title: "Compliance", body: "Identity verified + recording disclosure stated. ✓" });

  // 5. Governed agentic action: issue a retention credit.
  const credit = 15;
  const req = requestAction(ledger, {
    verb: "crm.issueCredit",
    what: `Issue $${credit} retention credit`,
    args: { id: scenario.accountId, amount: credit },
  });
  push({
    type: "card",
    title: "Action proposed",
    badge: req.decision,
    body: `Issue $${credit} retention credit — ${req.decision === "approval" ? "needs approval" : req.decision}.`,
  });
  let creditExecuted = false;
  if (req.decision === "approval" && autoApprove) {
    approve(ledger, req.entryIndex);
    const res = crmTools.issueCredit({ id: scenario.accountId, amount: credit });
    creditExecuted = res.ok;
    push({ type: "note", kind: "success", title: "Action executed", body: `Credit $${credit} posted (${res.postedCycle} cycle). Audit logged.` });
  }

  // 6. Outcome overlay + post-call analytics.
  push({ type: "metric", label: "Retention save", value: account.mrr * 12, unit: "ARR $" });
  push({ type: "metric", label: "QA score", value: 96 });
  let summary =
    "Customer at churn risk over outages + price. Agent de-escalated, offered a policy-grounded retention credit, and saved the account.";
  if (live) {
    try {
      summary = ask(
        `Summarize this support call in 2 sentences for post-call QA: ${scenario.turns
          .map((t) => t.who + ": " + t.text)
          .join(" | ")}`,
        { timeout: 60000 }
      )
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 400);
    } catch {
      /* keep seeded summary */
    }
  }
  push({ type: "doc", title: "Post-call summary", body: summary });
  push({ type: "note", kind: "info", title: "Behavioral insight", body: "Top performers acknowledge emotion within 20s — agent did at 0:14. ✓" });
  push({ type: "card", title: "Disposition", badge: "saved", body: "Retained · credit issued · follow-up scheduled." });

  return {
    events,
    citation,
    audit: auditTrail(ledger),
    creditExecuted,
    outcome: { saveArr: account.mrr * 12, qa: 96, disposition: "saved" },
  };
}

export { KB };
