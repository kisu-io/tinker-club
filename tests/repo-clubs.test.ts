import { test } from "node:test";
import assert from "node:assert/strict";
import "./helpers/testdb";
import { Users, Clubs, Memberships } from "../src/lib/repo";

function mkUser(email: string) {
  return Users.create({ name: email.split("@")[0], email, passwordHash: "x" });
}

test("create assigns a unique slug derived from the name", () => {
  const owner = mkUser("o1@example.com");
  const a = Clubs.create(owner.id, "Mountain Drivers");
  const b = Clubs.create(owner.id, "Mountain Drivers");
  assert.equal(a.slug, "mountain-drivers");
  assert.equal(b.slug, "mountain-drivers-2");
});

test("bySlug round-trips and adds the owner as OWNER member", () => {
  const owner = mkUser("o2@example.com");
  const club = Clubs.create(owner.id, "Coastal Cruisers");
  assert.equal(Clubs.bySlug("coastal-cruisers")?.id, club.id);
  assert.equal(Memberships.of(club.id, owner.id)?.role, "OWNER");
});

test("create stores branding when provided", () => {
  const owner = mkUser("o3@example.com");
  const club = Clubs.create(owner.id, "Track Day Club", {
    description: "weekend track runs",
    primaryColor: "#1d4ed8",
    logoUrl: "https://example.com/logo.png",
  });
  const fetched = Clubs.bySlug(club.slug)!;
  assert.equal(fetched.primaryColor, "#1d4ed8");
  assert.equal(fetched.logoUrl, "https://example.com/logo.png");
  assert.equal(fetched.description, "weekend track runs");
});

test("forUser returns slug for the user's clubs", () => {
  const owner = mkUser("o4@example.com");
  Clubs.create(owner.id, "Roadsters United");
  const list = Clubs.forUser(owner.id);
  assert.ok(list.some((c) => c.slug === "roadsters-united"));
});
