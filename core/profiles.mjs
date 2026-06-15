// Industry / company profiles — each bundles a brand, domain, knowledge base, scenarios and seed
// accounts so the WHOLE demo switches with one click. Switching a profile reconfigures the manifest;
// the live demo, retrieval, and context graph all follow. New profiles can be added here or minted
// via the MCP gateway.

export const PROFILES = [
  {
    id: "telecom",
    label: "Telecom",
    accent: "#6d4bff",
    meta: { brand: "Acme Telecom", domain: "telecom contact-center", agentName: "Maya" },
    knowledge: [
      { id: "KB-Retention-07", title: "Retention offers", text: "To prevent churn for tenured accounts in good standing, agents may offer a loyalty credit sized to the customer's tenure and value (commonly $10–$60), a temporary plan discount, or a concrete service-improvement commitment. Always lead with fixing the root issue before any monetary offer." },
      { id: "KB-Compliance-02", title: "Required disclosures", text: "Before any account change, the agent must verify identity (name + account PIN or last 4) and state the call-recording disclosure. Do not discuss account specifics until identity is confirmed." },
      { id: "KB-Billing-11", title: "Billing adjustments", text: "Disputed or erroneous charges can be reversed in full when the error is confirmed; goodwill credits post within one billing cycle and appear as a statement adjustment. Refund the actual disputed amount, not a fixed figure." },
      { id: "KB-Outage-04", title: "Service outages", text: "For confirmed outages, offer a prorated credit for the downtime window plus a status-page subscription; for business accounts, escalate to network ops and provide an ETA and an SLA-credit per the contract." },
      { id: "KB-Speed-08", title: "Slow speeds", text: "For under-spec speeds, run a remote line diagnostic first; if confirmed, offer a modem upgrade, a plan-tier change, or a credit for the affected period. Schedule a technician only if the line test is inconclusive." },
      { id: "KB-Equipment-09", title: "Equipment faults", text: "For a faulty modem or router, ship a free replacement with a self-install guide; dispatch a technician (truck roll) only if self-install fails. No charge for in-warranty equipment." },
      { id: "KB-Contract-12", title: "Contracts & ETF", text: "Early-termination fees may be pro-rated or waived for tenured or at-risk customers; always present downgrade and pause options before cancellation to preserve the relationship." },
      { id: "KB-WinBack-21", title: "Competitive win-back", text: "When a customer cites a competitor's offer, match within agent authority using a loyalty bundle or temporary discount; document the competing offer. Escalate to retention specialists for high-value accounts." },
    ],
    scenarios: [
      { id: "tel-retention", title: "Retention — outages + price", premise: "A tenured (4-year) customer calls, frustrated by repeated internet outages and feeling they overpay. They are weighing whether to cancel.", starter: "I've had it — my internet keeps dropping and I'm paying premium prices. I'm ready to cancel." },
      { id: "tel-billing", title: "Billing dispute", premise: "A customer disputes an unexpected $80 charge after their plan auto-renewed at a higher rate; they feel misled.", starter: "There's an $80 charge on my bill I never authorized and it auto-renewed higher. I want it reversed now." },
      { id: "tel-outage", title: "Outage — small business", premise: "A small-business owner calls during a regional outage that took down their store's payment system for hours.", starter: "Your outage took down my store's payment system for hours today — what are you going to do about it?" },
      { id: "tel-upgrade", title: "Upgrade / win-back", premise: "A customer's plan is too slow for new remote work and streaming; a competitor's fiber is tempting them.", starter: "My plan can't handle our remote work and streaming anymore, and a competitor's fiber looks better." },
    ],
    accounts: [{ name: "Tanaka, K.", plan: "Fiber 1G", mrr: 99 }],
  },
  {
    id: "fintech",
    label: "Financial services",
    accent: "#0f9d8f",
    meta: { brand: "Northstar Lending", domain: "consumer-lending support center", agentName: "Devon" },
    knowledge: [
      { id: "NL-Hardship-01", title: "Hardship programs", text: "Customers in genuine financial hardship may be offered a temporary payment deferral or a reduced-payment plan; the hardship reason must be documented." },
      { id: "NL-Disclosure-02", title: "Required disclosures", text: "Before discussing account specifics, verify identity (DOB + last 4) and state the call-recording and debt-collection disclosures where applicable." },
      { id: "NL-Dispute-03", title: "Disputed transactions", text: "Disputed transactions are placed on temporary hold pending investigation (up to 10 business days); provisional credit may be applied." },
      { id: "NL-Payoff-04", title: "Early payoff", text: "Early payoff quotes are valid for 10 days; personal loans carry no prepayment penalty." },
      { id: "NL-Autopay-05", title: "Autopay & failed payments", text: "A failed autopayment can be retried within 3 days with no late fee; offer to update the payment method and re-enroll in autopay for a small rate benefit." },
      { id: "NL-CreditReport-06", title: "Credit reporting", text: "Accounts brought current are reported as current on the next cycle; a goodwill removal of a single late mark may be requested for otherwise good-standing customers." },
      { id: "NL-Settlement-07", title: "Hardship settlement", text: "For severe hardship, a structured settlement or extended forbearance may be offered with documented hardship and supervisor approval; never promise terms outside policy." },
      { id: "NL-Verify-08", title: "Verification limits", text: "Never read full account or card numbers aloud — share only the last four. Decline requests that fail identity verification and offer secure-portal alternatives." },
    ],
    scenarios: [
      { id: "fin-hardship", title: "Payment hardship", premise: "A borrower who just lost income can't make this month's loan payment and fears default.", starter: "I just lost my job and I can't make this month's payment — I don't know what to do." },
      { id: "fin-dispute", title: "Disputed charge", premise: "A customer sees a payment they say they never authorized and wants it reversed immediately.", starter: "There's a $300 payment on my account I never set up — I want it reversed today." },
      { id: "fin-payoff", title: "Early payoff", premise: "A customer came into money and wants to pay off their loan early, worried about penalties.", starter: "I came into some money and want to pay this loan off — am I going to get hit with fees?" },
      { id: "fin-fraud", title: "Suspected fraud", premise: "A customer received an alert about suspicious activity on their account and is panicking.", starter: "I got a fraud alert on my account and I'm freaking out — what's happening?" },
    ],
    accounts: [{ name: "Carter, R.", plan: "Personal loan · 36mo", mrr: 240 }],
  },
  {
    id: "travel",
    label: "Travel",
    accent: "#4f7df0",
    meta: { brand: "Skyward Airlines", domain: "airline customer-care line", agentName: "Priya" },
    knowledge: [
      { id: "SK-Disruption-01", title: "Disruption handling", text: "For cancellations within Skyward's control, rebook on the next available flight at no charge or offer a refund; provide meal and hotel vouchers for overnight delays." },
      { id: "SK-Refund-02", title: "Refunds & credits", text: "Refundable fares are refunded to the original form of payment within 7 days; non-refundable fares may receive travel credit." },
      { id: "SK-Baggage-03", title: "Delayed/lost baggage", text: "For delayed baggage, file a report and offer interim-expense reimbursement up to the policy limit; lost baggage is compensated per the contract of carriage." },
      { id: "SK-Loyalty-04", title: "Loyalty priority", text: "Gold and Platinum members receive priority rebooking, waived change fees, and lounge access during disruptions." },
      { id: "SK-Rebook-05", title: "Rebooking & upgrades", text: "Rebook to the next available flight at no charge for controllable disruptions; offer the next cabin up when economy is sold out and the customer is high-value or stranded overnight." },
      { id: "SK-Weather-06", title: "Weather / ATC waivers", text: "For weather or air-traffic disruptions (outside Skyward's control), waive change fees and rebook free, but meal/hotel vouchers and compensation are discretionary, not guaranteed." },
      { id: "SK-Companion-07", title: "Families & companions", text: "Keep companions and families on the same itinerary when rebooking; prioritize unaccompanied minors and accessibility needs." },
      { id: "SK-Goodwill-08", title: "Goodwill & miles", text: "Goodwill miles or a travel credit may be offered for significant inconvenience, sized to status and severity; always document the reason." },
    ],
    scenarios: [
      { id: "trv-cancel", title: "Cancelled flight", premise: "A traveler's flight was cancelled and they must reach a wedding tomorrow morning.", starter: "My flight just got cancelled and I have to be at a wedding tomorrow — what are my options?" },
      { id: "trv-baggage", title: "Lost baggage", premise: "A passenger's checked bag never arrived and they have a presentation first thing.", starter: "My bag never showed up at the carousel and I have a presentation in the morning — where is it?" },
      { id: "trv-refund", title: "Refund after emergency", premise: "A customer wants a refund for a non-refundable fare after a family emergency made them miss the flight.", starter: "I had a family emergency and missed my flight — I need that money back, not a credit." },
      { id: "trv-loyalty", title: "Frequent-flyer win-back", premise: "A frustrated frequent flyer is considering switching airlines after repeated delays.", starter: "I fly with you constantly and I'm done with the delays — give me a reason to stay." },
    ],
    accounts: [{ name: "Olsen, K.", plan: "Gold loyalty", mrr: 180 }],
  },
  {
    id: "retail",
    label: "Retail",
    accent: "#e0476a",
    meta: { brand: "Lumen Retail", domain: "e-commerce support center", agentName: "Sasha" },
    knowledge: [
      { id: "LR-Returns-01", title: "Returns & refunds", text: "Returns are accepted within 30 days with a prepaid label; loyalty members get instant refunds before the item is received." },
      { id: "LR-Shipping-02", title: "Delayed shipments", text: "For shipments past the promised date, offer a free reship or a full refund plus expedited delivery; share live carrier tracking." },
      { id: "LR-PriceMatch-03", title: "Price match", text: "Match a lower price found within 14 days of purchase; otherwise a goodwill loyalty credit (commonly 5–15%) may be offered." },
      { id: "LR-Damaged-04", title: "Damaged / defective", text: "Damaged or defective items are replaced at no charge with a prepaid return label; no need to return before the replacement ships for low-value items." },
      { id: "LR-Fraud-05", title: "Unrecognized orders", text: "Place unrecognized orders on hold, verify identity, and refund confirmed fraudulent charges; flag the account for security review." },
      { id: "LR-Loyalty-06", title: "VIP loyalty", text: "VIP members receive free returns, early access to drops, and concierge handling during any service issue." },
      { id: "LR-Subscription-07", title: "Subscriptions", text: "Subscription orders can be paused, skipped, or cancelled anytime before the cutoff; refund any charge billed after a cancellation request." },
      { id: "LR-Warranty-08", title: "Warranty claims", text: "In-warranty defects are repaired or replaced at no cost; out-of-warranty, offer a discounted replacement or a trade-in credit." },
    ],
    scenarios: [
      { id: "ret-damaged", title: "Damaged on arrival", premise: "A customer received a clearly damaged item that was a gift and is upset it can't be used.", starter: "The blender I ordered showed up cracked and it was a birthday gift — this is so disappointing." },
      { id: "ret-late", title: "Late delivery", premise: "A shopper's order is days past the promised date with an event coming up.", starter: "My order is three days late and I needed it for this weekend — where is it?" },
      { id: "ret-refund", title: "Refund dispute", premise: "A customer returned an item two weeks ago and still hasn't seen the refund.", starter: "I sent that return back two weeks ago and there's still no refund on my card." },
      { id: "ret-pricematch", title: "Price-match request", premise: "A customer found the same item cheaper elsewhere right after buying it.", starter: "I bought this yesterday and now it's $40 cheaper on another site — can you match it?" },
    ],
    accounts: [{ name: "Bauer, L.", plan: "Loyalty Plus", mrr: 70 }],
  },
  {
    id: "healthcare",
    label: "Healthcare",
    accent: "#0f9d8f",
    meta: { brand: "Meridian Health", domain: "patient support line", agentName: "Noor" },
    knowledge: [
      { id: "MH-Billing-01", title: "Billing & assistance", text: "For an unexpected bill, provide an itemized review, screen for financial assistance, and offer an interest-free payment plan." },
      { id: "MH-Scheduling-02", title: "Scheduling", text: "Offer the next available appointment, a telehealth alternative, and a cancellation waitlist; never penalize for clinical-need reschedules." },
      { id: "MH-Coverage-03", title: "Coverage & appeals", text: "Run a benefits check, surface prior-authorization status, and walk the patient through the appeal process for denied claims." },
      { id: "MH-Rx-04", title: "Prescriptions", text: "Coordinate refills with the pharmacy; a 72-hour emergency supply may be arranged when a refill is delayed." },
      { id: "MH-Records-05", title: "Medical records", text: "Records are released via the secure portal after identity verification, within a 5-business-day turnaround." },
      { id: "MH-Care-06", title: "Duty of care", text: "Never provide medical advice or diagnoses; de-escalate distress with empathy and escalate clinical questions to the nurse line immediately." },
      { id: "MH-Telehealth-07", title: "Telehealth & triage", text: "Offer telehealth for non-emergency needs and after-hours nurse-line triage; for emergencies, direct the patient to call emergency services immediately." },
      { id: "MH-Copay-08", title: "Copays & estimates", text: "Provide a good-faith cost estimate and copay details before service; surface charity-care and sliding-scale options for eligible patients." },
    ],
    scenarios: [
      { id: "hc-bill", title: "Surprise bill", premise: "A patient received a large unexpected bill after a procedure they thought was covered.", starter: "I just got a $1,200 bill for a procedure I was told insurance would cover — I can't pay this." },
      { id: "hc-denial", title: "Claim denied", premise: "A patient's claim was denied and they don't understand why or what to do.", starter: "My claim got denied and nobody will tell me why — what am I supposed to do now?" },
      { id: "hc-appt", title: "Urgent reschedule", premise: "A patient needs an earlier appointment for a worsening issue but the next slot is weeks out.", starter: "My symptoms are getting worse and the soonest appointment is a month away — I can't wait that long." },
      { id: "hc-rx", title: "Prescription delay", premise: "A patient's essential medication refill is stuck and they're nearly out.", starter: "My refill hasn't gone through and I have one day of medication left — I need help now." },
    ],
    accounts: [{ name: "Rahman, S.", plan: "Care Plus", mrr: 120 }],
  },
];

// Demo form factors — each a distinct POC the harness builds & maintains.
export const FORMATS = [
  { id: "agent-assist", label: "Agent Assist", blurb: "A human agent handled the call; the AI whispers real-time next-best-actions, grounded knowledge, and a governed action." },
  { id: "ai-agent", label: "AI Agent", blurb: "An autonomous AI agent handles the customer directly, end to end — its reasoning, simulation and governed actions are the demo." },
];

export function getProfile(id) {
  return PROFILES.find((p) => p.id === id) || PROFILES[0];
}
