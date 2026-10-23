import { test, after } from "node:test";
import assert from "node:assert/strict";
import { closeDb } from "./helpers/testdb";
import { conn, normalizeUrl } from "../src/lib/db";

after(async () => { await closeDb(); });

test("normalizeUrl strips channel_binding and keeps other params", () => {
  const out = new URL(
    normalizeUrl("postgresql://u:p@ep-x-pooler.example.tech/db?sslmode=require&channel_binding=require"),
  );
  assert.equal(out.searchParams.get("channel_binding"), null);
  assert.equal(out.searchParams.get("sslmode"), "require");
  assert.equal(out.host, "ep-x-pooler.example.tech");
  assert.equal(out.pathname, "/db");
});

test("normalizeUrl leaves URLs without channel_binding intact", () => {
  const url = "postgresql://u:p@localhost:5432/db?sslmode=disable";
  assert.equal(normalizeUrl(url), url);
});

test("conn() recovers after a failed first connect", async () => {
  const goodUrl = process.env.DATABASE_URL!;
  const down = new URL(goodUrl);
  down.hostname = "127.0.0.1";
  down.port = "1"; // nothing listens here -> ECONNREFUSED

  process.env.DATABASE_URL = down.toString();
  await assert.rejects(conn());

  // Neon's default URL carries channel_binding=require; it must still connect.
  const neonStyle = new URL(goodUrl);
  neonStyle.searchParams.set("channel_binding", "require");
  process.env.DATABASE_URL = neonStyle.toString();
  try {
    const sql = await conn();
    const rows = await sql`SELECT 1 AS ok`;
    assert.equal(rows[0].ok, 1);
  } finally {
    process.env.DATABASE_URL = goodUrl;
  }
});
