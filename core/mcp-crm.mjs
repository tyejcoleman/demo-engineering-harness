// Mock CRM exposed as an MCP-style tool surface (account / tickets / credit).
// Seeded + deterministic so the on-stage path never depends on a live network call.
// A real MCP server can replace crmTools behind the same interface.

const ACCOUNTS = {
  "acme-tanaka": {
    id: "acme-tanaka",
    name: "Tanaka, K.",
    tenureMonths: 41,
    plan: "Fiber 1G",
    mrr: 99,
    status: "good_standing",
  },
};

const TICKETS = {
  "acme-tanaka": [
    { id: "T-2031", subject: "Intermittent outage (resolved)", ageDays: 12 },
    { id: "T-2044", subject: "Billing question", ageDays: 3 },
  ],
};

export const crmTools = {
  getAccount: ({ id }) => ACCOUNTS[id] || null,
  getTickets: ({ id }) => TICKETS[id] || [],
  issueCredit: ({ id, amount }) => ({ ok: !!ACCOUNTS[id], id, amount, postedCycle: "next" }),
};
