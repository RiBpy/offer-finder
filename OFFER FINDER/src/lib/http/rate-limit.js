// Fixed-window in-memory rate limiter. Each serverless instance keeps its own
// counters, so this is a best-effort guard; use a shared store (e.g. Redis) or
// the host's firewall for strict limits in production.

const buckets = new Map();

export function rateLimit(key, { limit, windowMs }) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset <= now) {
    b = { count: 0, reset: now + windowMs };
    buckets.set(key, b);
  }
  b.count++;
  if (buckets.size > 10000) {
    for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
  }
  return { ok: b.count <= limit, remaining: Math.max(0, limit - b.count), retryAfterS: Math.ceil((b.reset - now) / 1000) };
}

export function clientIp(request) {
  const fwd = request.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : request.headers.get("x-real-ip") || "unknown").trim();
}
