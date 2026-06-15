import { provider, claudeAvailable } from "@/core/llm.mjs";
import { readiness } from "@/core/readiness.mjs";
import { loadSpec } from "@/core/spec.mjs";
import { TOOLS } from "@/core/mcp-tools.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Status of the harness layer: which generator/MCP is wired, and live readiness of the demo system.
// The Claude Code connector reports the REAL MCP tool surface (TOOLS), so the gateway breadth is accurate.
export async function GET() {
  const spec = loadSpec();
  let ready: unknown[] = [];
  try {
    ready = readiness();
  } catch {
    ready = [];
  }
  let claude = false;
  try {
    claude = claudeAvailable();
  } catch {
    claude = false;
  }
  const toolNames = TOOLS.map((t: { name: string }) => t.name);
  const mcp = (spec.mcp || []).map((m: { id: string }) => (m.id === "claude-code" ? { ...m, tools: toolNames } : m));
  return Response.json(
    { provider: provider(), claude, mcp, readiness: ready, target: spec.meta?.target ?? 90 },
    { headers: { "Cache-Control": "no-store" } }
  );
}
