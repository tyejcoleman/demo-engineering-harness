import { loadSpec, addScenario, removeScenario } from "@/core/spec.mjs";
import { generateScenario } from "@/core/seed.mjs";
import { recordAudit } from "@/core/audit.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  return Response.json({ scenarios: loadSpec().scenarios || [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.action === "generate") {
    const s = await generateScenario(); // token-free Claude Code
    if (s) {
      addScenario(s);
      recordAudit({ actor: "claude-code", action: "scenario.generate", detail: s.title });
    }
  } else if (body.action === "add" && body.scenario) {
    const s = addScenario(body.scenario);
    recordAudit({ actor: "operator", action: "scenario.add", detail: s.title });
  }
  return Response.json({ scenarios: loadSpec().scenarios || [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id") || "";
  removeScenario(id);
  recordAudit({ actor: "operator", action: "scenario.remove", detail: id });
  return Response.json({ scenarios: loadSpec().scenarios || [] }, { headers: { "Cache-Control": "no-store" } });
}
