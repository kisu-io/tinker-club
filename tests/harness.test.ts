import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { resetDb, closeDb } from "./helpers/testdb";
import { Users } from "../src/lib/repo";

before(async () => { await resetDb(); });
after(async () => { await closeDb(); });

test("temp DB is writable and isolated", async () => {
  const u = await Users.create({ name: "Harness", email: "h@example.com", passwordHash: "x" });
  assert.equal((await Users.byId(u.id))?.email, "h@example.com");
});