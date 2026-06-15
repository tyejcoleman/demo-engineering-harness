import { loadSpec, saveSpec } from "@/core/spec.mjs";
import { recordAudit } from "@/core/audit.mjs";
import { seedAccounts } from "@/core/seed.mjs";
import { crmAccounts, crmStats } from "@/core/crm.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// A small pool of synthetic accounts so "New environment" mints a fresh, isolated, seeded data set
// without any live network — the same clean-room principle the rest of the demo follows.
const POOL = [
  { name: "Rivera, M.", plan: "Fiber 500", mrr: 75 },
  { name: "Osei, A.", plan: "Gigabit Pro", mrr: 145 },
  { name: "Nguyen, T.", plan: "Fiber 1G", mrr: 99 },
  { name: "Schmidt, L.", plan: "Business 2G", mrr: 220 },
  { name: "Haddad, S.", plan: "Fiber 300", mrr: 60 },
  { name: "Park, J.", plan: "Fiber 1G", mrr: 110 },
];

const BASELINE = { id: "baseline", label: "Baseline (seeded)", baseline: true, accounts: [{ name: "Tanaka, K.", plan: "Fiber 1G", mrr: 99 }] };

function envView(spec: any) {
  const env = spec.environment || BASELINE;
  return {
    id: env.id,
    label: env.label,
    baseline: !!env.baseline,
    accounts: env.accounts || [],
    sources: [
      { kind: "crm", name: "Simulated CRM", status: "source of truth", count: crmStats(spec.profile || "telecom").total },
      { kind: "kb", name: "Knowledge base", status: "seeded", count: (spec.knowledge || []).length },
    ],
    crm: crmAccounts(spec.profile || "telecom"),
    crmStats: crmStats(spec.profile || "telecom"),
  };
}

export async function GET() {
  return Response.json(envView(loadSpec()), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const { action } = await req.json().catch(() => ({}));
  if (action === "reset") {
    saveSpec({ environment: BASELINE });
    recordAudit({ actor: "operator", action: "env.reset", detail: "reset to baseline (seeded)" });
  } else if (action === "new") {
    const n = 2 + Math.floor(Math.random() * 2);
    const accounts = [...POOL]
      .sort(() => Math.random() - 0.5)
      .slice(0, n)
      .map((a) => ({ ...a, mrr: Math.max(40, a.mrr + Math.floor(Math.random() * 30) - 10) }));
    const id = "env-" + Math.random().toString(36).slice(2, 6);
    saveSpec({ environment: { id, label: "Fresh sandbox · " + id, baseline: false, accounts } });
    recordAudit({ actor: "operator", action: "env.new", detail: `${id} · ${accounts.length} seeded accounts` });
  } else if (action === "generate") {
    // token-free Claude Code generates realistic accounts for the current domain/brand
    const accounts = await seedAccounts(3);
    const id = "env-" + Math.random().toString(36).slice(2, 6);
    saveSpec({ environment: { id, label: "Claude-generated · " + id, baseline: false, accounts } });
    recordAudit({ actor: "claude-code", action: "env.generate", detail: `${id} · ${accounts.length} accounts generated` });
  }
  return Response.json(envView(loadSpec()), { headers: { "Cache-Control": "no-store" } });
}
