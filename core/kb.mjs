// Seeded knowledge base + lexical retrieval (deterministic). A live hybrid retriever
// (vector + keyword + rerank) can replace retrieve() behind the same interface.

export const KB = [
  {
    id: "KB-Retention-07",
    title: "Retention offers",
    text: "To prevent churn for tenured accounts in good standing, agents may offer a loyalty credit sized to the customer's tenure and value (commonly $10–$60), a temporary plan discount, or a concrete service-improvement commitment.",
  },
  {
    id: "KB-Compliance-02",
    title: "Required disclosures",
    text: "Before any account change, the agent must verify identity and state the call recording disclosure.",
  },
  {
    id: "KB-Billing-11",
    title: "Billing adjustments",
    text: "Account credits post within one billing cycle and appear as a statement adjustment.",
  },
  {
    id: "KB-Outage-04",
    title: "Service outages",
    text: "For confirmed outages, offer a prorated credit and a status-page subscription.",
  },
];

const STOP = new Set(["the", "a", "an", "to", "for", "of", "and", "in", "on", "is", "be", "may", "any", "i"]);

function tokens(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t));
}

export function retrieve(query, k = 1, kb = KB) {
  const q = new Set(tokens(query));
  return (Array.isArray(kb) && kb.length ? kb : KB).map((doc) => {
    const dt = tokens(doc.title + " " + doc.text);
    let score = 0;
    for (const t of dt) if (q.has(t)) score++;
    return { doc, score };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .filter((s) => s.score > 0)
    .map((s) => s.doc);
}
