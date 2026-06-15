// Clean-room governance core: policy-gated actions + append-only audit ledger.
// Reads are allowed; mutating actions require approval before they execute. Every
// action is logged, so an agentic copilot is accountable by construction.

const POLICY = {
  "crm.read": "allow",
  "crm.issueCredit": "approval",
};

export function createLedger() {
  return { audit: [], approvals: [] };
}

export function requestAction(ledger, action) {
  const effect = POLICY[action.verb] ?? "approval";
  const index = ledger.audit.length;
  ledger.audit.push({
    index,
    verb: action.verb,
    args: action.args || {},
    effect,
    status: effect === "allow" ? "executed" : "pending",
  });
  return {
    decision: effect,
    entryIndex: index,
    proof: { what: action.what || action.verb, why: [`policy(${action.verb}) = ${effect}`] },
  };
}

export function approve(ledger, entryIndex) {
  const e = ledger.audit[entryIndex];
  if (!e) return false;
  e.status = "executed";
  ledger.approvals.push(entryIndex);
  return true;
}

export function auditTrail(ledger) {
  return ledger.audit.slice();
}
