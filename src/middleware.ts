import { NextRequest, NextResponse } from "next/server";

// node:crypto is allowed in middleware as of Next 14; randomUUID() is also
// safe in the edge runtime but we use base64-encoded random bytes for CSP.
function nonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

const isProd = process.env.NODE_ENV === "production";
// Only enforce upgrade-insecure-requests + HSTS when we actually have a real
// domain with HTTPS (DOMAIN set and not ":80"). When serving over plain HTTP
// (no domain yet), these headers break all subresources in the browser.
const hasHttps = isProd && !!process.env.DOMAIN && process.env.DOMAIN !== ":80";

function buildCsp(n: string): string {
  const directives = [
    "default-src 'self'",
    // RSC bootstrap injects inline scripts; 'strict-dynamic' lets Next-loaded
    // scripts execute under the same nonce trust without enumerating hashes.
    // In dev, also allow eval/inline for HMR.
    isProd
      ? `script-src 'self' 'nonce-${n}' 'strict-dynamic'`
      : `script-src 'self' 'nonce-${n}' 'unsafe-inline' 'unsafe-eval'`,
    // Tailwind + Next inject inline <style>; 'unsafe-inline' on styles is the
    // standard tradeoff. No 'unsafe-eval' on styles.
    "style-src 'self' 'unsafe-inline'",
    // Vehicle photos, gallery, and document thumbnails come from external
    // https hosts (e.g. Unsplash for the seed). data: covers SVG placeholders.
    "img-src 'self' https: data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    hasHttps ? "upgrade-insecure-requests" : "",
  ];
  return directives.filter(Boolean).join("; ");
}

export function middleware(req: NextRequest) {
  const n = nonce();
  const csp = buildCsp(n);

  // Forward the nonce so server components can read it via headers() if they
  // need to attach it to their own inline <script> tags.
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-nonce", n);
  reqHeaders.set(
    isProd ? "content-security-policy" : "content-security-policy-report-only",
    csp,
  );

  const res = NextResponse.next({ request: { headers: reqHeaders } });

  res.headers.set(
    isProd ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only",
    csp,
  );
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  );
  if (hasHttps) {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }

  return res;
}

export const config = {
  matcher: [
    // Apply on every request except Next's own static assets, image
    // optimization endpoint, favicon, and the healthcheck route. The negative
    // lookahead is the recommended Next 14 pattern.
    "/((?!_next/static|_next/image|favicon\\.ico|healthz).*)",
  ],
};
