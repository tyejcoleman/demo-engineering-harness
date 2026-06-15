// Behavioral probe for Slice 4: the Live Copilot pipeline.
// PASS only if it emits a valid stream, the coaching citation is GROUNDED (quote exists
// verbatim in the KB — no hallucination), the agentic action required approval and was
// approved + executed + audited, and the run is deterministic.
import { runCopilot } from "../core/copilot.mjs";
import { repair } from "../core/renderer.mjs";
import { KB } from "../core/kb.mjs";

const checks = [];
const ok = (n, c) => checks.push([n, !!c]);

const r = runCopilot();

// 1. Valid stream of PanelSpec events.
ok("emits-stream", Array.isArray(r.events) && r.events.length >= 6);
ok("all-valid", r.events.every((e) => e.type && repair(e).type === e.type));

// 2. Grounded: citation quote exists verbatim in the KB (no hallucination).
ok("has-citation", !!(r.citation && r.citation.source && r.citation.quote));
ok("citation-grounded", !!r.citation && KB.some((d) => d.id === r.citation.source && d.text === r.citation.quote));

// 3. Governed action: required approval, was executed, and is in the audit trail.
const credit = r.audit.find((a) => a.verb === "crm.issueCredit");
ok("action-needed-approval", !!credit && credit.effect === "approval");
ok("action-executed", r.creditExecuted === true && !!credit && credit.status === "executed");
ok("read-was-audited", r.audit.some((a) => a.verb === "crm.read"));

// 4. Deterministic.
ok("deterministic", JSON.stringify(runCopilot().events) === JSON.stringify(runCopilot().events));

const failed = checks.filter(([, c]) => !c).map(([n]) => n);
console.log(failed.length === 0 ? "PASS" : "FAIL: " + failed.join(", "));
