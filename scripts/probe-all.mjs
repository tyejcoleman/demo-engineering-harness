// Aggregate verify gate: runs every behavioral probe and reports. Used by the `verify`
// script and the example Claude Code Stop hook, so every session ends with a real check.
import { execSync } from "node:child_process";

const probes = ["spine", "renderer", "driver", "converge", "copilot", "portal", "loop", "mcp", "advisor"];
let allPass = true;

for (const p of probes) {
  try {
    const out = execSync(`node scripts/probe-${p}.mjs`, { encoding: "utf8" }).trim();
    const pass = out.includes("PASS");
    allPass = allPass && pass;
    console.log(`${pass ? "✅" : "❌"} ${p.padEnd(9)} ${out}`);
  } catch {
    allPass = false;
    console.log(`❌ ${p.padEnd(9)} ERROR`);
  }
}

console.log(allPass ? "\nALL PASS" : "\nSOME FAILED");
process.exit(allPass ? 0 : 1);
