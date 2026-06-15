import { PROFILES, applyProfile, loadSpec, FORMATS, setFormat } from "@/core/spec.mjs";
import { recordAudit } from "@/core/audit.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const spec = loadSpec();
  return Response.json(
    {
      profiles: PROFILES.map((p: { id: string; label: string; accent?: string; meta: { brand: string; domain: string } }) => ({ id: p.id, label: p.label, accent: p.accent, brand: p.meta.brand, domain: p.meta.domain })),
      formats: FORMATS,
      active: spec.profile,
      format: spec.format,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.format) {
    const spec = setFormat(body.format);
    recordAudit({ actor: "operator", action: "format.set", detail: spec.format });
    return Response.json({ ok: true, format: spec.format }, { headers: { "Cache-Control": "no-store" } });
  }
  const spec = applyProfile(body.id);
  recordAudit({ actor: "operator", action: "profile.switch", detail: `${spec.profile} · ${spec.meta.brand}` });
  return Response.json({ ok: true, profile: spec.profile, brand: spec.meta.brand }, { headers: { "Cache-Control": "no-store" } });
}
