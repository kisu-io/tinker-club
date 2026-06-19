import { cookies } from "next/headers";
import crypto from "crypto";
import { Users } from "./repo";

const COOKIE = "mc_session";
const DEV_FALLBACK_SECRET = "dev-insecure-secret";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const rawSecret = process.env.SESSION_SECRET?.trim() ?? "";
const isProd = process.env.NODE_ENV === "production";

// Reject obviously-not-real secrets: the dev fallback, anything too short to
// resist brute force, and common placeholder phrases that ship in templates.
const PLACEHOLDER_PATTERNS = [/change[-_ ]?this/i, /insecure/i, /placeholder/i, /example/i];
function looksLikePlaceholder(s: string): boolean {
  return PLACEHOLDER_PATTERNS.some((re) => re.test(s));
}

if (isProd) {
  if (rawSecret === "" || rawSecret === DEV_FALLBACK_SECRET) {
    throw new Error(
      "SESSION_SECRET is required in production. Set it to a long random value (openssl rand -hex 32).",
    );
  }
  if (rawSecret.length < 32) {
    throw new Error(
      `SESSION_SECRET is too short (${rawSecret.length} chars). Use at least 32 characters (openssl rand -hex 32).`,
    );
  }
  if (looksLikePlaceholder(rawSecret)) {
    throw new Error(
      "SESSION_SECRET looks like a placeholder ('change-this' / 'example' / 'insecure'). Replace it with a real secret (openssl rand -hex 32).",
    );
  }
}

const SECRET = rawSecret || DEV_FALLBACK_SECRET;
let warnedDevFallback = false;

function sign(value: string) {
  const sig = crypto.createHmac("sha256", SECRET).update(value).digest("base64url");
  return `${value}.${sig}`;
}

function unsign(signed: string): string | null {
  const idx = signed.lastIndexOf(".");
  if (idx < 0) return null;
  const value = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  const expected = crypto.createHmac("sha256", SECRET).update(value).digest("base64url");
  // constant-time compare
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return value;
}

export function createSession(userId: string) {
  if (!isProd && SECRET === DEV_FALLBACK_SECRET && !warnedDevFallback) {
    warnedDevFallback = true;
    console.warn(
      "[session] SESSION_SECRET not set — using the insecure dev fallback. Set SESSION_SECRET before any non-local use.",
    );
  }
  const payload = JSON.stringify({ uid: userId, iat: Date.now() });
  const token = sign(Buffer.from(payload).toString("base64url"));
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function destroySession() {
  cookies().set(COOKIE, "", { path: "/", maxAge: 0 });
}

export function getSessionUserId(): string | null {
  const raw = cookies().get(COOKIE)?.value;
  if (!raw) return null;
  const value = unsign(raw);
  if (!value) return null;
  try {
    const payload = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    return payload.uid as string;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const uid = getSessionUserId();
  if (!uid) return null;
  return (await Users.byId(uid)) ?? null;
}
