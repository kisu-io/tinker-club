import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { resetDb, closeDb } from "./helpers/testdb";
import { Users, Clubs, Memberships, Vehicles, Shares } from "../src/lib/repo";

before(async () => { await resetDb(); });
after(async () => { await closeDb(); });

async function user(email: string) {
  return Users.create({ name: email.split("@")[0], email, passwordHash: "x" });
}

test("a car shared into group A is not bookable by a member of only group B", async () => {
  const alice = await user("alice@ex.com"); // owns car, in group A
  const bob = await user("bob@ex.com");     // in group B only

  const groupA = await Clubs.create(alice.id, "Group A");
  const groupB = await Clubs.create(bob.id, "Group B");
  await Memberships.add(groupB.id, bob.id, "MEMBER"); // already owner, no-op safety

  const car = await Vehicles.create({ ownerId: alice.id, make: "Mazda", model: "MX-5", year: 1995 });
  await Shares.add(car.id, groupA.id, true); // shared into A only

  // Bob is not in group A -> car not bookable by Bob
  assert.equal(await Shares.isBookableBy(car.id, bob.id), undefined);

  // Bob's bookable list does not include the car
  const bobBookable = await Shares.bookableFor(bob.id);
  assert.equal(bobBookable.some((v) => v.id === car.id), false);
});

test("Shares.forClub returns only that group's cars", async () => {
  const alice = await user("alice2@ex.com");
  const a = await Clubs.create(alice.id, "Alpha");
  const b = await Clubs.create(alice.id, "Bravo");
  const carA = await Vehicles.create({ ownerId: alice.id, make: "Honda", model: "S2000", year: 2003 });
  const carB = await Vehicles.create({ ownerId: alice.id, make: "Toyota", model: "AE86", year: 1986 });
  await Shares.add(carA.id, a.id, true);
  await Shares.add(carB.id, b.id, true);

  const inA = await Shares.forClub(a.id);
  assert.equal(inA.length, 1);
  assert.equal(inA[0].id, carA.id);
});

test("Memberships.of returns undefined for a non-member (gate for requireGroupMember)", async () => {
  const owner = await user("owner3@ex.com");
  const stranger = await user("stranger3@ex.com");
  const club = await Clubs.create(owner.id, "Closed Club");
  assert.equal(await Memberships.of(club.id, stranger.id), undefined);
  assert.ok(await Memberships.of(club.id, owner.id)); // owner is a member
});

test("once Bob joins group A, the car becomes bookable", async () => {
  const alice = await user("alice4@ex.com");
  const bob = await user("bob4@ex.com");
  const a = await Clubs.create(alice.id, "Joinable");
  const car = await Vehicles.create({ ownerId: alice.id, make: "BMW", model: "M3", year: 2008 });
  await Shares.add(car.id, a.id, false);

  assert.equal(await Shares.isBookableBy(car.id, bob.id), undefined);
  await Memberships.add(a.id, bob.id, "MEMBER");
  assert.ok(await Shares.isBookableBy(car.id, bob.id)); // now bookable
});