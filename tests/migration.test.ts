import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// Simulate an OLD database created before the slug/branding columns existed,
// then let the app's migrate() (triggered lazily on first query) upgrade it.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-migrate-"));
process.env.DATA_DIR = dir;

const old = new DatabaseSync(path.join(dir, "app.db"));
old.exec(
  `CREATE TABLE User (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
     passwordHash TEXT NOT NULL, language TEXT NOT NULL DEFAULT 'en',
     createdAt TEXT NOT NULL DEFAULT (datetime('now')));
   CREATE TABLE Club (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
     ownerId TEXT NOT NULL, inviteCode TEXT UNIQUE NOT NULL,
     createdAt TEXT NOT NULL DEFAULT (datetime('now')));`,
);
old.prepare("INSERT INTO User (id,email,name,passwordHash) VALUES ('u1','a@b.c','A','x')").run();
old.prepare("INSERT INTO Club (id,name,ownerId,inviteCode) VALUES ('c1','Vintage Vipers','u1','CODE12')").run();
old.close();

test("migrate backfills slugs for clubs created before the slug column existed", async () => {
  // Dynamic import so DATA_DIR is set before db.ts opens its lazy singleton.
  const { Clubs } = await import("../src/lib/repo");
  const club = Clubs.byId("c1"); // first query -> migrate() -> ensureColumns + backfill
  assert.ok(club);
  assert.equal(club!.slug, "vintage-vipers");
  assert.ok(Clubs.bySlug("vintage-vipers"));
});
