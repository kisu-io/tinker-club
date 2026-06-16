import { test } from "node:test";
import assert from "node:assert/strict";
import "./helpers/testdb";
import { Users } from "../src/lib/repo";

test("temp DB is writable and isolated", () => {
  const u = Users.create({ name: "Harness", email: "h@example.com", passwordHash: "x" });
  assert.equal(Users.byId(u.id)?.email, "h@example.com");
});
