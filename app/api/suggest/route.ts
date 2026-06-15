import { suggestDemos } from "@/core/suggest.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Token-free: suggestDemos reasons on Claude Code (subscription auth), not the API-key path.
export async function GET(req: Request) {
  const n = Math.max(1, Math.min(5, Number(new URL(req.url).searchParams.get("n")) || 3));
  const suggestions = await suggestDemos(n);
  return Response.json({ suggestions }, { headers: { "Cache-Control": "no-store" } });
}
