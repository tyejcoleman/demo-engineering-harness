import { listAudit, clearAudit } from "@/core/audit.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ entries: listAudit(80) }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE() {
  clearAudit();
  return Response.json({ entries: [] }, { headers: { "Cache-Control": "no-store" } });
}
