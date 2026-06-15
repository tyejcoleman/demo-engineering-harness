// Simulated CRM — the customer source of truth. In production this is Salesforce / Zendesk /
// HubSpot / the contact-center platform; here we generate a full, rich, per-industry book of business
// (deterministic + varied) so the context graph, decisions and the brain are grounded in real-looking
// records. Each profile has its own naming, plans, ticket types and value/risk distribution.
import { getProfile } from "./profiles.mjs";

const FIRST = ["J.", "M.", "A.", "R.", "S.", "K.", "T.", "L.", "D.", "P.", "N.", "C.", "E.", "B.", "O.", "G."];
const SUR = {
  telecom: ["Tanaka", "Rivera", "Osei", "Nguyen", "Schmidt", "Park", "Haddad", "Cohen", "Ito", "Bauer", "Mensah", "Lindqvist", "Okafor", "Reyes", "Novak", "Petrova"],
  fintech: ["Carter", "Delgado", "Brooks", "Yamamoto", "Novak", "Abara", "Singh", "Fischer", "Romano", "Khan", "Walsh", "Petrov", "Adeyemi", "Cruz", "Hansen", "Mwangi"],
  travel: ["Olsen", "Marchetti", "Haas", "Kapoor", "Saito", "Dubois", "Nilsson", "Owusu", "Vargas", "Klein", "Tan", "Ferreira", "Andersson", "Mwangi", "Bianchi", "Yoon"],
  retail: ["Bauer", "Lopez", "Chen", "Muller", "Ferreira", "Okoye", "Sato", "Romano", "Patel", "Hughes", "Nilsen", "Ortiz", "Kang", "Abbas", "Wood", "Silva"],
  healthcare: ["Rahman", "Cohen", "Ibrahim", "Nakamura", "Garcia", "Wagner", "Kaur", "Lindholm", "Mensah", "Park", "Russo", "Diallo", "Hansen", "Costa", "Yusuf", "Tran"],
};
const PLANS = {
  telecom: ["Fiber 300", "Fiber 500", "Fiber 1G", "Gigabit Pro", "Business 2G"],
  fintech: ["Personal loan · 24mo", "Personal loan · 36mo", "Auto loan · 60mo", "Line of credit", "Debt consolidation"],
  travel: ["Basic", "Silver", "Gold loyalty", "Platinum", "Corporate"],
  retail: ["Standard", "Loyalty Plus", "Prime", "Business", "VIP concierge"],
  healthcare: ["Basic", "Care Plus", "Family", "Premier", "Employer plan"],
};
const TICKETS = {
  telecom: ["Intermittent outage", "Billing question", "Speed complaint", "Equipment swap", "Late payment", "Plan change request"],
  fintech: ["Payment hardship", "Disputed charge", "Payoff quote", "Statement question", "Fraud alert", "Autopay failure"],
  travel: ["Delayed baggage", "Flight change", "Refund request", "Loyalty status", "Seat upgrade", "Missed connection"],
  retail: ["Damaged item", "Late delivery", "Refund pending", "Price match", "Wrong item", "Subscription change"],
  healthcare: ["Surprise bill", "Claim denied", "Appointment reschedule", "Prescription delay", "Records request", "Coverage question"],
};
const REGIONS = ["West", "Midwest", "Northeast", "South", "EMEA", "APAC"];
const STATUSES = ["good_standing", "good_standing", "good_standing", "vip", "at_risk", "at_risk"];
const SENT = ["positive", "neutral", "neutral", "neutral", "negative", "frustrated"];

function mulberry(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function crmAccounts(profileId = "telecom", n = 22) {
  getProfile(profileId); // validate
  const sur = SUR[profileId] || SUR.telecom;
  const plans = PLANS[profileId] || PLANS.telecom;
  const tix = TICKETS[profileId] || TICKETS.telecom;
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = mulberry(hash(profileId + ":" + i));
    const status = STATUSES[Math.floor(r() * STATUSES.length)];
    const mrr = 40 + Math.floor(r() * 260);
    const tenure = 2 + Math.floor(r() * 118);
    const ltv = Math.round(mrr * tenure * (0.6 + r() * 0.9));
    const risk = status === "at_risk" ? 55 + Math.floor(r() * 40) : 5 + Math.floor(r() * 45);
    const nTix = Math.floor(r() * 3);
    const tickets = Array.from({ length: nTix }, (_, k) => ({
      id: `T-${1000 + (hash(profileId + i + "" + k) % 9000)}`,
      subject: tix[Math.floor(r() * tix.length)],
      ageDays: 1 + Math.floor(r() * 30),
    }));
    out.push({
      id: `${profileId}-${i}`,
      name: `${sur[i % sur.length]}, ${FIRST[Math.floor(r() * FIRST.length)]}`,
      plan: plans[Math.floor(r() * plans.length)],
      mrr,
      tenureMonths: tenure,
      status,
      ltv,
      riskScore: risk,
      sentiment: SENT[Math.floor(r() * SENT.length)],
      region: REGIONS[Math.floor(r() * REGIONS.length)],
      tickets,
    });
  }
  return out;
}

export function crmStats(profileId = "telecom") {
  const a = crmAccounts(profileId);
  return {
    total: a.length,
    vip: a.filter((x) => x.status === "vip").length,
    atRisk: a.filter((x) => x.status === "at_risk").length,
    avgLtv: Math.round(a.reduce((s, x) => s + x.ltv, 0) / a.length),
    openTickets: a.reduce((s, x) => s + x.tickets.length, 0),
  };
}

// A real CRM record for a live call — prefers an at-risk / ticketed account so the scenario has teeth.
export function crmPick(profileId = "telecom") {
  const a = crmAccounts(profileId);
  const hot = a.filter((x) => x.status === "at_risk" || x.tickets.length);
  const pool = hot.length ? hot : a;
  return pool[Math.floor(Math.random() * pool.length)];
}
