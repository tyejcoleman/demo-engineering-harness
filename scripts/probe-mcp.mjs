// Behavioral probe for Slice 9: the Forge MCP tool surface + the visual-feedback edge.
import { TOOLS, callTool } from "../core/mcp-tools.mjs";

const checks = [];
const ok = (n, c) => checks.push([n, !!c]);

ok("tools-listed", Array.isArray(TOOLS) && TOOLS.length >= 8 && TOOLS.every((t) => t.name && t.description));
ok("produce", callTool("forge_produce", { name: "x" }).events.length >= 3);
ok("improve", callTool("forge_improve").finalScore === 100);
ok("readiness", callTool("forge_readiness").length === 2);
ok("visual-targets", Array.isArray(callTool("forge_visual_targets").routes) && callTool("forge_visual_targets").rubric.length >= 4);

// The visual feedback edge: record a finding -> it lands in the queue -> resolve -> gone.
const rec = callTool("forge_record_finding", { key: "contrast-status", label: "Low contrast on /status pills", severity: "high", route: "/status" });
ok("finding-recorded", rec.added === true && rec.queue.some((i) => i.key === "contrast-status"));
const dup = callTool("forge_record_finding", { key: "contrast-status", label: "dup", severity: "high" });
ok("finding-deduped", dup.added === false);
const res = callTool("forge_resolve", { key: "contrast-status" });
ok("finding-resolved", res.resolved === true && !res.queue.some((i) => i.key === "contrast-status"));

let threw = false;
try {
  callTool("nope");
} catch {
  threw = true;
}
ok("unknown-throws", threw);

const failed = checks.filter(([, c]) => !c).map(([n]) => n);
console.log(failed.length === 0 ? "PASS" : "FAIL: " + failed.join(", "));
