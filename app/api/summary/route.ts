import { loadSpec } from "@/core/spec.mjs";
import { askAsync } from "@/core/llm.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// AI-generated briefing of the environment + situation — "what context the AI has for this demo".
export async function GET(req: Request) {
  const premise = new URL(req.url).searchParams.get("premise") || "";
  const spec = loadSpec();
  const ctx = {
    brand: spec.meta.brand,
    domain: spec.meta.domain,
    policies: (spec.knowledge || []).length,
    scenarios: (spec.scenarios || []).length,
    accounts: (spec.environment?.accounts || []).length,
    format: spec.format,
    profile: spec.profile,
  };
  let summary = "";
  try {
    summary = (
      await askAsync(
        `Brief a demo viewer in 2 sentences on the context this AI has for a ${ctx.domain} interaction at ${ctx.brand}: ${ctx.policies} grounding knowledge policies and a seeded CRM are in scope, and this is the situation: "${premise}". Then add one short phrase naming what the live context graph will trace (account → concern → policy → strategy → customer-twin → governed action → outcome). Concrete and plain, no preamble.`,
        { timeout: 30000, tier: "fast" }
      )
    )
      .trim()
      .slice(0, 420);
  } catch {
    summary = `${ctx.brand} · ${ctx.domain}. ${ctx.policies} grounding policies and a seeded CRM are in scope for this call. The live context graph traces account → concern → policy → strategy → customer-twin → governed action → outcome.`;
  }
  return Response.json({ summary, context: ctx }, { headers: { "Cache-Control": "no-store" } });
}
