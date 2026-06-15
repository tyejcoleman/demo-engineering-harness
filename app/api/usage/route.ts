import { getUsage } from "@/core/usage.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hidden cost/usage status: today's estimated spend vs the daily cap. Used by the in-app status chip.
export async function GET() {
  return Response.json(getUsage(), { headers: { "Cache-Control": "no-store" } });
}
