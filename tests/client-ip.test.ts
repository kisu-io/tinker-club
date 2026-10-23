import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { clientIpFromHeaders } from "../src/lib/client-ip";

afterEach(() => { delete process.env.TRUST_CF_CONNECTING_IP; });

const spoofed = new Headers({
  "cf-connecting-ip": "6.6.6.6",
  "x-forwarded-for": "203.0.113.7, 10.0.0.1",
});

test("ignores cf-connecting-ip by default and uses x-forwarded-for", () => {
  assert.equal(clientIpFromHeaders(spoofed), "203.0.113.7");
});

test("ignores cf-connecting-ip unless TRUST_CF_CONNECTING_IP is exactly 'true'", () => {
  process.env.TRUST_CF_CONNECTING_IP = "1";
  assert.equal(clientIpFromHeaders(spoofed), "203.0.113.7");
});

test("honours cf-connecting-ip when TRUST_CF_CONNECTING_IP=true", () => {
  process.env.TRUST_CF_CONNECTING_IP = "true";
  assert.equal(clientIpFromHeaders(spoofed), "6.6.6.6");
});

test("falls back to 'unknown' with no IP headers", () => {
  assert.equal(clientIpFromHeaders(new Headers()), "unknown");
});
