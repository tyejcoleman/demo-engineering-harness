// Claude-Code-generated (token-free) seed data + scenarios. This is the "generate data / manage
// scenarios" side of the MCP gateway: a connected Claude Code (or the UI buttons) can mint realistic
// accounts and new scenarios for the current manifest domain/brand, all without API tokens.
import { askJsonAsync } from "./llm.mjs";
import { loadSpec } from "./spec.mjs";

const FALLBACK_ACCOUNTS = [
  { name: "Rivera, M.", plan: "Fiber 500", mrr: 75 },
  { name: "Osei, A.", plan: "Gigabit Pro", mrr: 145 },
  { name: "Nguyen, T.", plan: "Fiber 1G", mrr: 99 },
  { name: "Schmidt, L.", plan: "Business 2G", mrr: 220 },
];

export async function seedAccounts(n = 3) {
  const spec = loadSpec();
  const count = Math.max(1, Math.min(6, n));
  try {
    const j = await askJsonAsync(
      `Invent ${count} realistic, varied ${spec.meta.domain} customer accounts for ${spec.meta.brand}. Vary names, plans, tenure and value. JSON: {"accounts":[{"name":"<Surname, Initial>","plan":"<plan name>","mrr":<int 40-300>}]}`,
      { timeout: 70000 }
    );
    const accounts = (Array.isArray(j.accounts) ? j.accounts : [])
      .slice(0, count)
      .map((a) => ({ name: String(a.name || "Customer").slice(0, 40), plan: String(a.plan || "Plan").slice(0, 30), mrr: Math.max(20, Math.min(500, Number(a.mrr) || 89)) }));
    return accounts.length ? accounts : FALLBACK_ACCOUNTS.slice(0, count);
  } catch {
    return FALLBACK_ACCOUNTS.slice(0, count);
  }
}

export async function generateScenario() {
  const spec = loadSpec();
  try {
    const s = await askJsonAsync(
      `Invent a fresh, realistic inbound ${spec.meta.domain} customer situation for ${spec.meta.brand} — distinct and concrete. JSON: {"title":"<=6 words","premise":"<2 sentences: caller, issue, emotion>","starter":"<the customer's opening line>"}`,
      { timeout: 70000 }
    );
    return {
      id: "s-" + Math.random().toString(36).slice(2, 7),
      title: String(s.title || "Scenario").slice(0, 60),
      premise: String(s.premise || "").slice(0, 400),
      starter: String(s.starter || "").slice(0, 300),
    };
  } catch {
    return null;
  }
}
