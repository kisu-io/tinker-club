// In-process sliding-window limiter. No external dep.
// Single-process scope only — multi-instance deploys need an external store.

import { headers } from "next/headers";

interface Entry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Entry>();
const MAX_KEYS = 5000;

// Survives Next dev hot reloads by stashing the Map on globalThis.
const g = globalThis as unknown as { __mcRateLimit?: Map<string, Entry> };
const store: Map<string, Entry> = g.__mcRateLimit ?? (g.__mcRateLimit = buckets);

function gc(now: number) {
  if (store.size < MAX_KEYS) return;
  for (const [k, v] of store) {
    if (v.resetAt <= now) store.delete(k);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check-and-increment a fixed-window counter.
 *
 * @param key   identifier for the bucket (caller composes IP, action, etc.)
 * @param max   maximum requests allowed within the window
 * @param windowMs  window size in milliseconds
 */
export function check(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  gc(now);
  const cur = store.get(key);
  if (!cur || cur.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, resetAt: now + windowMs };
  }
  if (cur.count >= max) {
    return { allowed: false, remaining: 0, resetAt: cur.resetAt };
  }
  cur.count += 1;
  return { allowed: true, remaining: max - cur.count, resetAt: cur.resetAt };
}

/** Drop a bucket after a successful operation. */
export function reset(key: string) {
  store.delete(key);
}

/**
 * Best-effort client IP for rate limiting.
 * Cloudflare Tunnel forwards the real visitor IP via cf-connecting-ip and
 * x-forwarded-for; most reverse proxies use x-forwarded-for.
 */
export function clientIp(): string {
  const h = headers();
  const cf = h.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}
