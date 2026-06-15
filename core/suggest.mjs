// The intelligence layer: suggests new demos by reasoning over the demo memory + manifest.
// Runs on Claude Code (token-free, subscription auth) — never the API-key path — because this is
// platform management, not the prospect-facing demo runtime. Falls back to a deterministic spread.
import { askJsonAsync } from "./llm.mjs";
import { listRuns } from "./history.mjs";
import { loadSpec } from "./spec.mjs";

const FALLBACK = [
  { title: "Proactive churn save", premise: "A high-value customer hasn't called but usage dropped sharply after a competitor's launch.", starter: "I'm thinking about switching — your service just hasn't kept up lately.", why: "Tests proactive, data-triggered outreach rather than reactive support." },
  { title: "Fraud / disputed charges", premise: "A long-tenure customer sees hundreds in charges for services they say they never used.", starter: "There are charges here I never made — I want them gone and an explanation.", why: "Exercises high-stakes empathy + governance/audit on a sensitive action." },
  { title: "Accessibility / vulnerable caller", premise: "An elderly customer is confused by a bill change and frustrated by past transfers.", starter: "I don't understand this bill and nobody will just help me.", why: "Stresses patience, plain-language explanation, and careful de-escalation." },
];

export async function suggestDemos(n = 3) {
  const spec = loadSpec();
  const runs = listRuns(20);
  const summary = runs.length ? runs.map((r) => `- ${r.title} → ${r.disposition} (QA ${r.qa})`).join("\n") : "(no demos run yet)";
  try {
    const j = await askJsonAsync(
      `You are the intelligence layer of a ${spec.meta.domain} demo platform for ${spec.meta.brand}. ` +
        `Here are the demos run so far:\n${summary}\n\n` +
        `Reason about coverage gaps and suggest ${n} NEW demo scenarios worth running next — each genuinely different from the above across issue type, customer profile, emotion, and the resolution it would demand. ` +
        `JSON: {"suggestions":[{"title":"<=6 words","premise":"<2 sentences>","starter":"<customer opening line>","why":"<1 sentence: the gap this covers>"}]}`,
      { timeout: 70000 }
    );
    const out = (Array.isArray(j.suggestions) ? j.suggestions : []).slice(0, n).map((s) => ({
      title: String(s.title || "Suggested demo").slice(0, 60),
      premise: String(s.premise || "").slice(0, 400),
      starter: String(s.starter || "").slice(0, 300),
      why: String(s.why || "").slice(0, 160),
    }));
    return out.length ? out : FALLBACK.slice(0, n);
  } catch {
    return FALLBACK.slice(0, n);
  }
}
