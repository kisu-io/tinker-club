import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { resetDb, closeDb } from "./helpers/testdb";
import {
  Users, Vehicles, Clubs, Memberships, Shares, Bookings, Handovers,
  shareVehicleAtomic, unshareVehicleAtomic, requestBookingAtomic,
  cancelBookingAtomic, saveHandoverAtomic, leaveClubAtomic,
} from "../src/lib/repo";
import { all, conn } from "../src/lib/db";

before(async () => { await resetDb(); });
after(async () => { await closeDb(); });

let n = 0;
const mkUser = () => { n++; return Users.create({ name: `u${n}`, email: `u${n}@example.com`, passwordHash: "x" }); };
const mkCar = (ownerId: string) => Vehicles.create({ ownerId, make: "Alfa", model: "Spider", year: 1972 });
const book = (vehicleId: string, borrowerId: string, status: string, startDate = "2030-01-01", endDate = "2030-01-02") =>
  Bookings.create({ vehicleId, borrowerId, startDate, endDate, status });
const statusOf = async (bid: string) => (await Bookings.byId(bid))!.status;

async function setup() {
  const owner = await mkUser();
  const borrower = await mkUser();
  const car = await mkCar(owner.id);
  return { owner, borrower, car };
}

/* G1 */
test("only one of two simultaneous overlapping requests succeeds", async () => {
  const { borrower, car } = await setup();
  const sql = await conn();
  // Hold a SHARE lock on Booking: both requests can run their overlap SELECT but block on INSERT,
  // forcing the interleaving the race needs. Without the Vehicle row lock both would insert.
  const gate = await sql.reserve();
  await gate`BEGIN`;
  await gate`LOCK TABLE "Booking" IN SHARE MODE`;
  const req = () => requestBookingAtomic({ vehicleId: car.id, borrowerId: borrower.id, startDate: "2030-03-01", endDate: "2030-03-05", status: "APPROVED" });
  const pending = Promise.all([req(), req()]);
  for (let i = 0; i < 100; i++) {
    const [{ waiting }] = await sql<{ waiting: number }[]>`SELECT count(DISTINCT pid)::int AS waiting FROM pg_locks WHERE NOT granted`;
    if (waiting >= 2) break;
    await new Promise((r) => setTimeout(r, 20));
  }
  await gate`COMMIT`;
  gate.release();

  const results = await pending;
  assert.equal(results.filter((r) => r.bid).length, 1);
  assert.equal(results.filter((r) => r.error).length, 1);
  assert.equal((await Bookings.forVehicle(car.id)).length, 1);
});

/* Past dates */
test("rejects a booking whose start date is in the past", async () => {
  const { borrower, car } = await setup();
  const res = await requestBookingAtomic({ vehicleId: car.id, borrowerId: borrower.id, startDate: "2000-01-01", endDate: "2030-01-01", status: "APPROVED" });
  assert.ok(res.error);
  assert.equal((await Bookings.forVehicle(car.id)).length, 0);
});

test("accepts a booking that starts today", async () => {
  const { borrower, car } = await setup();
  const today = new Date().toISOString().slice(0, 10);
  const res = await requestBookingAtomic({ vehicleId: car.id, borrowerId: borrower.id, startDate: today, endDate: today, status: "APPROVED" });
  assert.ok(res.bid, res.error);
});

/* G3 */
test("isBookableBy is instant when any of the borrower's clubs grants instant", async () => {
  const { owner, borrower, car } = await setup();
  const approvalClub = await Clubs.create(owner.id, "Approval");
  const instantClub = await Clubs.create(owner.id, "Instant");
  await Memberships.add(approvalClub.id, borrower.id);
  await Memberships.add(instantClub.id, borrower.id);
  await shareVehicleAtomic(car.id, approvalClub.id, true);
  assert.equal((await Shares.isBookableBy(car.id, borrower.id))?.requireApproval, 1);

  await shareVehicleAtomic(car.id, instantClub.id, false);
  for (let i = 0; i < 5; i++) assert.equal((await Shares.isBookableBy(car.id, borrower.id))?.requireApproval, 0);
});

test("isBookableBy returns undefined when no club shares the car with the user", async () => {
  const { borrower, car } = await setup();
  assert.equal(await Shares.isBookableBy(car.id, borrower.id), undefined);
});

/* G4 */
test("pickup is refused unless the booking is APPROVED", async () => {
  const { owner, borrower, car } = await setup();
  for (const status of ["PENDING", "DECLINED", "CANCELLED", "COMPLETED"]) {
    const bid = await book(car.id, borrower.id, status);
    const res = await saveHandoverAtomic(bid, borrower.id, "pickup", { pickedUpAt: new Date().toISOString() });
    assert.equal(res.ok, false, status);
    assert.equal(await Handovers.forBooking(bid), undefined, status);
  }
  const bid = await book(car.id, borrower.id, "APPROVED");
  assert.deepEqual(await saveHandoverAtomic(bid, owner.id, "pickup", { pickedUpAt: new Date().toISOString() }), { ok: true });
  assert.ok((await Handovers.forBooking(bid))?.pickedUpAt);
});

test("return is refused before pickup, and completes the booking after it", async () => {
  const { borrower, car } = await setup();
  const bid = await book(car.id, borrower.id, "APPROVED");
  const early = await saveHandoverAtomic(bid, borrower.id, "return", { returnedAt: new Date().toISOString() });
  assert.equal(early.ok, false);
  assert.equal(await statusOf(bid), "APPROVED");

  await saveHandoverAtomic(bid, borrower.id, "pickup", { pickedUpAt: new Date().toISOString() });
  assert.deepEqual(await saveHandoverAtomic(bid, borrower.id, "return", { returnedAt: new Date().toISOString() }), { ok: true });
  assert.equal(await statusOf(bid), "COMPLETED");
});

test("handover is refused for someone who is neither owner nor borrower", async () => {
  const { borrower, car } = await setup();
  const stranger = await mkUser();
  const bid = await book(car.id, borrower.id, "APPROVED");
  assert.equal((await saveHandoverAtomic(bid, stranger.id, "pickup", { pickedUpAt: new Date().toISOString() })).ok, false);
  assert.equal(await Handovers.forBooking(bid), undefined);
});

/* G5 */
test("cancel is refused after pickup but allowed before it", async () => {
  const { owner, borrower, car } = await setup();
  const out = await book(car.id, borrower.id, "APPROVED");
  await saveHandoverAtomic(out, borrower.id, "pickup", { pickedUpAt: new Date().toISOString() });
  assert.equal((await cancelBookingAtomic(out, owner.id)).ok, false);
  assert.equal((await cancelBookingAtomic(out, borrower.id)).ok, false);
  assert.equal(await statusOf(out), "APPROVED");

  const notYet = await book(car.id, borrower.id, "APPROVED", "2030-02-01", "2030-02-02");
  assert.deepEqual(await cancelBookingAtomic(notYet, borrower.id), { ok: true });
  assert.equal(await statusOf(notYet), "CANCELLED");
});

test("cancel keeps the owner/borrower check and refuses finished bookings", async () => {
  const { borrower, car } = await setup();
  const stranger = await mkUser();
  const bid = await book(car.id, borrower.id, "PENDING");
  assert.equal((await cancelBookingAtomic(bid, stranger.id)).ok, false);
  assert.equal(await statusOf(bid), "PENDING");
  const done = await book(car.id, borrower.id, "COMPLETED", "2030-02-01", "2030-02-02");
  assert.equal((await cancelBookingAtomic(done, borrower.id)).ok, false);
});

/* G6 */
test("re-saving pickup never clears a reported damage flag", async () => {
  const { borrower, car } = await setup();
  const bid = await book(car.id, borrower.id, "APPROVED");
  await Handovers.upsert(bid, { pickedUpAt: new Date().toISOString(), damageReported: 1 });
  await saveHandoverAtomic(bid, borrower.id, "pickup", { pickupMileageKm: 100, pickedUpAt: new Date().toISOString() });
  assert.equal((await Handovers.forBooking(bid))?.damageReported, 1);
  await Handovers.upsert(bid, { damageReported: 0 });
  assert.equal((await Handovers.forBooking(bid))?.damageReported, 1);
});

/* G7 */
test("unsharing cancels future bookings of borrowers who lose access, not picked-up or still-entitled ones", async () => {
  const { owner, borrower, car } = await setup();
  const other = await mkUser();
  const clubA = await Clubs.create(owner.id, "A");
  const clubB = await Clubs.create(owner.id, "B");
  await Memberships.add(clubA.id, borrower.id);
  await Memberships.add(clubA.id, other.id);
  await Memberships.add(clubB.id, other.id);
  await shareVehicleAtomic(car.id, clubA.id, true);
  await shareVehicleAtomic(car.id, clubB.id, true);

  const pending = await book(car.id, borrower.id, "PENDING", "2030-01-01", "2030-01-02");
  const approved = await book(car.id, borrower.id, "APPROVED", "2030-02-01", "2030-02-02");
  const pickedUp = await book(car.id, borrower.id, "APPROVED", "2030-03-01", "2030-03-02");
  await Handovers.upsert(pickedUp, { pickedUpAt: new Date().toISOString() });
  const past = await book(car.id, borrower.id, "APPROVED", "2000-01-01", "2000-01-02");
  const stillShared = await book(car.id, other.id, "APPROVED", "2030-04-01", "2030-04-02");

  await unshareVehicleAtomic(car.id, clubA.id);

  assert.equal(await statusOf(pending), "CANCELLED");
  assert.equal(await statusOf(approved), "CANCELLED");
  assert.equal(await statusOf(pickedUp), "APPROVED");
  assert.equal(await statusOf(past), "APPROVED");
  assert.equal(await statusOf(stillShared), "APPROVED");
});

test("leaving a club cancels the member's future bookings only for cars they can no longer access", async () => {
  const { owner, borrower, car } = await setup();
  const otherCar = await mkCar(owner.id);
  const clubA = await Clubs.create(owner.id, "LA");
  const clubB = await Clubs.create(owner.id, "LB");
  await Memberships.add(clubA.id, borrower.id);
  await Memberships.add(clubB.id, borrower.id);
  await shareVehicleAtomic(car.id, clubA.id, true);
  await shareVehicleAtomic(otherCar.id, clubA.id, true);
  await shareVehicleAtomic(otherCar.id, clubB.id, true);

  const lost = await book(car.id, borrower.id, "APPROVED");
  const kept = await book(otherCar.id, borrower.id, "APPROVED");

  await leaveClubAtomic(clubA.id, borrower.id);

  assert.equal(await Memberships.of(clubA.id, borrower.id), undefined);
  assert.equal(await statusOf(lost), "CANCELLED");
  assert.equal(await statusOf(kept), "APPROVED");
});

test("the club owner cannot leave via leaveClubAtomic", async () => {
  const { owner } = await setup();
  const club = await Clubs.create(owner.id, "Mine");
  await leaveClubAtomic(club.id, owner.id);
  assert.ok(await Memberships.of(club.id, owner.id));
});

/* Indexes */
test("booking indexes exist", async () => {
  const rows = await all<{ indexdef: string }>(`SELECT indexdef FROM pg_indexes WHERE tablename = 'Booking'`);
  const defs = rows.map((r) => r.indexdef).join("\n");
  assert.match(defs, /\("vehicleId", "startDate"\)/);
  assert.match(defs, /\("borrowerId"\)/);
});
