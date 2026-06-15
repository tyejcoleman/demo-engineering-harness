// Behavioral probe for Slice 5: the portal/management plane readiness model.
// PASS only if readiness() reports both demos, each with real checks, both ready.
import { readiness } from "../core/readiness.mjs";

const checks = [];
const ok = (n, c) => checks.push([n, !!c]);

const demos = readiness();
ok("two-demos", demos.length === 2);
ok("each-has-checks", demos.every((d) => d.checks.length >= 3));
ok("forge-ready", demos.find((d) => d.id === "forge")?.ready === true);
ok("copilot-ready", demos.find((d) => d.id === "copilot")?.ready === true);

const failed = checks.filter(([, c]) => !c).map(([n]) => n);
console.log(failed.length === 0 ? "PASS" : "FAIL: " + failed.join(", "));
