import { getBrain, resetBrain, distill, validate, applyImprovement } from "@/core/brain.mjs";
import { recordAudit } from "@/core/audit.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(getBrain(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.action === "distill") {
    const artifact = distill();
    recordAudit({ actor: "operator", action: "brain.distill", detail: `v${artifact.version} · process extracted (no seed data)` });
    return Response.json({ artifact, brain: getBrain() }, { headers: { "Cache-Control": "no-store" } });
  }
  if (body.action === "validate") {
    const result = validate(body.samples || 500);
    recordAudit({ actor: "operator", action: "brain.validate", detail: `${result.success ?? 0}% on ${result.samples ?? 0} unseen cases` });
    return Response.json({ result, brain: getBrain() }, { headers: { "Cache-Control": "no-store" } });
  }
  if (body.action === "apply_improvement") {
    const brain = applyImprovement(body.text, body.concern);
    recordAudit({ actor: "operator", action: "brain.improve", detail: `human-approved → graph: ${String(body.text || "").slice(0, 80)}` });
    return Response.json({ brain }, { headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({ error: "unknown action" }, { status: 400 });
}

export async function DELETE() {
  recordAudit({ actor: "operator", action: "brain.reset", detail: "context graph + policy cleared" });
  return Response.json(resetBrain(), { headers: { "Cache-Control": "no-store" } });
}
