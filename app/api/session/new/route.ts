import { resetSpec } from "@/core/spec.mjs";
import { resetAllBrains } from "@/core/brain.mjs";
import { clearRuns } from "@/core/history.mjs";
import { clearAudit } from "@/core/audit.mjs";
import { resetAllFeedback } from "@/core/feedback.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// New-session reset: every visitor starts from a clean, correct demo — no trained brain, no switched
// industry, no accumulated history/audit leaking in from a prior session. The daily cost meter
// (usage.json) is intentionally NOT reset — the spend cap must stay global across all visitors.
export async function POST() {
  resetSpec(); // manifest → default industry (telecom), default format/scenarios
  resetAllBrains(); // every industry's brain back to untrained
  clearRuns(); // demo memory empty
  clearAudit(); // audit trail empty
  resetAllFeedback(); // Loop-2 active-feedback log empty (don't leak between visitors)
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
