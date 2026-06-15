import { getFeedback } from "@/core/feedback.mjs";
import { loadSpec } from "@/core/spec.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Loop 2 — the active-feedback record for the current industry: blind CX-evaluator scores + the system
// improvements it keeps proposing from real calls.
export async function GET() {
  const profile = loadSpec().profile || "telecom";
  return Response.json(getFeedback(profile), { headers: { "Cache-Control": "no-store" } });
}
