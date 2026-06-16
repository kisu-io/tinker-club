import { test } from "node:test";
import assert from "node:assert/strict";
import "./helpers/testdb";
import { Users, Clubs, Memberships, Vehicles, Shares } from "../src/lib/repo";

function user(email: string) {
  return Users.create({ name: email.split("@")[0], email, passwordHash: "x" });
}

test("a car shared into group A is not bookable by a member of only group B", () => {
  const alice = user("alice@ex.com"); // owns car, in group A
  const bob = user("bob@ex.com");     // in group B only

  const groupA = Clubs.create(alice.id, "Group A");
  const groupB = Clubs.create(bob.id, "Group B");
  Memberships.add(groupB.id, bob.id, "MEMBER"); // already owner, no-op safety

  const car = Vehicles.create({ ownerId: alice.id, make: "Mazda", model: "MX-5", year: 1995 });
  Shares.add(car.id, groupA.id, true); // shared into A only

  // Bob is not in group A -> car not bookable by Bob
  assert.equal(Shares.isBookableBy(car.id, bob.id), undefined);

  // Bob's bookable list does not include the car
  const bobBookable = Shares.bookableFor(bob.id);
  assert.equal(bobBookable.some((v) => v.id === car.id), false);
});

test("Shares.forClub returns only that group's cars", () => {
  const alice = user("alice2@ex.com");
  const a = Clubs.create(alice.id, "Alpha");
  const b = Clubs.create(alice.id, "Bravo");
  const carA = Vehicles.create({ ownerId: alice.id, make: "Honda", model: "S2000", year: 2003 });
  const carB = Vehicles.create({ ownerId: alice.id, make: "Toyota", model: "AE86", year: 1986 });
  Shares.add(carA.id, a.id, true);
  Shares.add(carB.id, b.id, true);

  const inA = Shares.forClub(a.id) as any[];
  assert.equal(inA.length, 1);
  assert.equal(inA[0].id, carA.id);
});

test("Memberships.of returns undefined for a non-member (gate for requireGroupMember)", () => {
  const owner = user("owner3@ex.com");
  const stranger = user("stranger3@ex.com");
  const club = Clubs.create(owner.id, "Closed Club");
  assert.equal(Memberships.of(club.id, stranger.id), undefined);
  assert.ok(Memberships.of(club.id, owner.id)); // owner is a member
});

test("once Bob joins group A, the car becomes bookable", () => {
  const alice = user("alice4@ex.com");
  const bob = user("bob4@ex.com");
  const a = Clubs.create(alice.id, "Joinable");
  const car = Vehicles.create({ ownerId: alice.id, make: "BMW", model: "M3", year: 2008 });
  Shares.add(car.id, a.id, false);

  assert.equal(Shares.isBookableBy(car.id, bob.id), undefined);
  Memberships.add(a.id, bob.id, "MEMBER");
  assert.ok(Shares.isBookableBy(car.id, bob.id)); // now bookable
});
