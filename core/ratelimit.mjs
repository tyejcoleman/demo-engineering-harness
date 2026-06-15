// Lightweight per-IP rate limiting for the expensive (LLM-backed) routes, so a single visitor can't
// hammer the demo and burn the daily budget. In-memory fixed-window counter — adequate for a
// single-container deploy; pair it with the hard cost cap in usage.mjs for the real guarantee.
const buckets = new Map();

export function clientIp(req) {
  const h = req.headers;
  return (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || "local";
}

export function rateLimit(ip, { max = 20, windowMs = 60000 } = {}) {
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b || now > b.reset) {
    b = { count: 0, reset: now + windowMs };
    buckets.set(ip, b);
  }
  b.count += 1;
  // opportunistic cleanup so the map can't grow unbounded
  if (buckets.size > 5000) for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
  return { ok: b.count <= max, remaining: Math.max(0, max - b.count), retryAfter: Math.ceil((b.reset - now) / 1000) };
}
