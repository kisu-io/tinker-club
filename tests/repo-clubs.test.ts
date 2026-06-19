import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { resetDb, closeDb } from "./helpers/testdb";
import { Users, Clubs, Memberships } from "../src/lib/repo";

before(async () => { await resetDb(); });
after(async () => { await closeDb(); });

function mkUser(email: string) {
  return Users.create({ name: email.split("@")[0], email, passwordHash: "x" });
}

test("create assigns a unique slug derived from the name", async () => {
  const owner = await mkUser("o1@example.com");
  const a = await Clubs.create(owner.id, "Mountain Drivers");
  const b = await Clubs.create(owner.id, "Mountain Drivers");
  assert.equal(a.slug, "mountain-drivers");
  assert.equal(b.slug, "mountain-drivers-2");
});

test("bySlug round-trips and adds the owner as OWNER member", async () => {
  const owner = await mkUser("o2@example.com");
  const club = await Clubs.create(owner.id, "Coastal Cruisers");
  assert.equal((await Clubs.bySlug("coastal-cruisers"))?.id, club.id);
  assert.equal((await Memberships.of(club.id, owner.id))?.role, "OWNER");
});

test("create stores branding when provided", async () => {
  const owner = await mkUser("o3@example.com");
  const club = await Clubs.create(owner.id, "Track Day Club", {
    description: "weekend track runs",
    primaryColor: "#1d4ed8",
    logoUrl: "https://example.com/logo.png",
  });
  const fetched = (await Clubs.bySlug(club.slug))!;
  assert.equal(fetched.primaryColor, "#1d4ed8");
  assert.equal(fetched.logoUrl, "https://example.com/logo.png");
  assert.equal(fetched.description, "weekend track runs");
});

test("forUser returns slug for the user's clubs", async () => {
  const owner = await mkUser("o4@example.com");
  await Clubs.create(owner.id, "Roadsters United");
  const list = await Clubs.forUser(owner.id);
  assert.ok(list.some((c) => c.slug === "roadsters-united"));
});