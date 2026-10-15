// Small helpers shared by the server functions.
export const json = (status, body, extraHeaders = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders },
});

export const fail = (status, code, message, headers) => json(status, { ok: false, error: { code, message } }, headers);

/** Visitor IP as reported by Vercel's edge network. */
export function clientIp(req) {
  return req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

/** Best-effort, per-instance sliding-window rate limiter. */
export function createRateLimiter({ windowMs, max }) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    const limited = recent.length >= max;
    if (!limited) recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) hits.clear();
    return limited;
  };
}
