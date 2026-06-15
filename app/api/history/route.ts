import { listRuns, runStats, clearRuns } from "@/core/history.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ runs: listRuns(50), stats: runStats() }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE() {
  clearRuns();
  return Response.json({ runs: [], stats: runStats() }, { headers: { "Cache-Control": "no-store" } });
}
