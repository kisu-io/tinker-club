/**
 * Best-effort client IP for rate limiting, from request headers.
 * Cloudflare Tunnel forwards the real visitor IP via cf-connecting-ip and
 * x-forwarded-for; most reverse proxies use x-forwarded-for.
 * cf-connecting-ip is client-controlled unless Cloudflare really sits in
 * front, so it is only trusted when TRUST_CF_CONNECTING_IP=true.
 */
export function clientIpFromHeaders(h: Pick<Headers, "get">): string {
  const cf = process.env.TRUST_CF_CONNECTING_IP === "true" ? h.get("cf-connecting-ip") : null;
  if (cf) return cf.trim();
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}
