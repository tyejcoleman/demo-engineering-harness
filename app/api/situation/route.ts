import { generateSituation } from "@/core/demo.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const recent = (url.searchParams.get("recent") || "").split("|").map((s) => s.trim()).filter(Boolean);
  const s = await generateSituation(recent);
  return Response.json(s, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
