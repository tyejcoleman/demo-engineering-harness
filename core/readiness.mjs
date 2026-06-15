// Demo-readiness, computed in-process from the SAME behavior the probes assert.
// Powers the portal status pills and the leadership view — live, not a static list.
import { repair } from "./renderer.mjs";
import { runDriverFallback } from "./driver.mjs";
import { converge } from "./converge.mjs";
import { runCopilot } from "./copilot.mjs";
import { KB } from "./kb.mjs";

function check(name, fn) {
  try {
    return { name, pass: !!fn() };
  } catch (e) {
    return { name, pass: false, error: String(e && e.message) };
  }
}

export function readiness() {
  const forgeChecks = [
    check("generative-UI renderer (safe-degrade)", () => repair({ type: "script" }).type === "note"),
    check("agent driver stream", () => runDriverFallback({ name: "x" }).length >= 3),
    check("convergence loop reaches ready", () =>
      converge({
        initialState: { a: false },
        criteria: [{ id: "a", test: (s) => s.a }],
        act: (s) => {
          s.a = true;
          return "set a";
        },
      }).ready
    ),
  ];

  const r = runCopilot();
  const copilotChecks = [
    check("grounded citation (verbatim KB)", () => !!r.citation && KB.some((d) => d.id === r.citation.source && d.text === r.citation.quote)),
    check("governed action + audit", () => r.creditExecuted && r.audit.some((a) => a.verb === "crm.issueCredit" && a.status === "executed")),
    check("post-call analytics", () => !!r.outcome && r.outcome.qa > 0),
  ];

  return [
    { id: "forge", name: "Forge", tag: "Demo A", checks: forgeChecks },
    { id: "copilot", name: "Live Copilot", tag: "Demo B", checks: copilotChecks },
  ].map((d) => {
    const passed = d.checks.filter((c) => c.pass).length;
    return { ...d, passed, total: d.checks.length, ready: passed === d.checks.length, pct: Math.round((100 * passed) / d.checks.length) };
  });
}
