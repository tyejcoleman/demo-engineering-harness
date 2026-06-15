import { loadSpec, saveSpec, resetSpec } from "@/core/spec.mjs";
import { recordAudit } from "@/core/audit.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(loadSpec(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body && body.__reset) {
    recordAudit({ actor: "operator", action: "config.reset", detail: "manifest reset to baseline" });
    return Response.json(resetSpec(), { headers: { "Cache-Control": "no-store" } });
  }
  const detail = Object.entries((body && body.meta) || {}).map(([k, v]) => `${k}=${v}`).join(", ") || Object.keys(body || {}).join(", ");
  recordAudit({ actor: "operator", action: "config.update", detail });
  return Response.json(saveSpec(body || {}), { headers: { "Cache-Control": "no-store" } });
}
