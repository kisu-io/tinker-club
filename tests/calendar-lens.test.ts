import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { resetDb, closeDb } from "./helpers/testdb";
import {
  Users, Vehicles, Clubs, Memberships, Shares, Bookings, Blocks, Calendar,
  shareVehicleAtomic, requestBookingAtomic, addBlockAtomic, cancelBookingAtomic, deleteVehicleAtomic,
} from "../src/lib/repo";
import { all, run } from "../src/lib/db";
import { nextFree, rangesOverlap, type SlotRange } from "../src/lib/slots";
import { addDays, monthWeeks, parseMonth, parseDay, shiftMonth } from "../src/lib/calendar";
import { buildAgenda } from "../src/lib/agenda";
import type { AgendaRow } from "../src/lib/repo";

before(async () => { await resetDb(); });
after(async () => { await closeDb(); });

const R = (startDate: string, startHalf: "AM" | "PM", endDate: string, endHalf: "AM" | "PM"): SlotRange =>
  ({ startDate, startHalf, endDate, endHalf });

let n = 0;
const mkUser = () => { n++; return Users.create({ name: `cal${n}`, email: `cal${n}@example.com`, passwordHash: "x" }); };

async function setupShared(requireApproval = false) {
  const owner = await mkUser();
  const borrower = await mkUser();
  const car = await Vehicles.create({ ownerId: owner.id, make: "Lancia", model: "Fulvia", year: 1970 });
  const club = await Clubs.create(owner.id, `Cal${n}`);
  await Memberships.add(club.id, borrower.id);
  await shareVehicleAtomic(car.id, club.id, requireApproval);
  return { owner, borrower, car, club };
}

const request = (vehicleId: string, borrowerId: string, r: SlotRange) => requestBookingAtomic({ vehicleId, borrowerId, ...r });

/* ---------- pure half-day slot rules ---------- */
test("half-day slots: AM end and PM start on the same day do not overlap", () => {
  assert.equal(rangesOverlap(R("2030-01-01", "AM", "2030-01-03", "AM"), R("2030-01-03", "PM", "2030-01-05", "PM")), false);
  assert.equal(rangesOverlap(R("2030-01-01", "AM", "2030-01-03", "PM"), R("2030-01-03", "PM", "2030-01-05", "PM")), true);
  assert.equal(rangesOverlap(R("2030-01-03", "AM", "2030-01-03", "AM"), R("2030-01-03", "PM", "2030-01-03", "PM")), false);
});

test("nextFree skips busy ranges and keeps the requested length", () => {
  const busy = [R("2030-01-02", "AM", "2030-01-03", "AM"), R("2030-01-03", "PM", "2030-01-04", "AM")];
  assert.deepEqual(nextFree(busy, R("2030-01-02", "AM", "2030-01-02", "PM")), R("2030-01-04", "PM", "2030-01-05", "AM"));
  assert.deepEqual(nextFree(busy, R("2030-01-10", "AM", "2030-01-10", "PM")), R("2030-01-10", "AM", "2030-01-10", "PM"));
});

test("calendar helpers build Monday-first month grids and sanitize URL params", () => {
  const weeks = monthWeeks("2030-01"); // 1 Jan 2030 is a Tuesday
  assert.deepEqual(weeks[0].slice(0, 2), [null, "2030-01-01"]);
  assert.equal(weeks.flat().filter(Boolean).length, 31);
  assert.ok(weeks.every((w) => w.length === 7));
  assert.equal(parseMonth("2030-13", "2030-05-02"), "2030-05");
  assert.equal(parseMonth("2030-02"), "2030-02");
  assert.equal(parseDay("nope", "2030-05-02"), "2030-05-02");
  assert.equal(shiftMonth("2030-12", 1), "2031-01");
  assert.equal(addDays("2030-02-28", 1), "2030-03-01");
});

/* ---------- half-day bookings in the DB ---------- */
test("same-day AM->PM turnover is bookable; an overlapping half is refused with a next-free hint", async () => {
  const { car, borrower } = await setupShared();
  const first = await request(car.id, borrower.id, R("2030-03-01", "AM", "2030-03-03", "AM"));
  assert.ok(first.bid, first.error);

  const turnover = await request(car.id, borrower.id, R("2030-03-03", "PM", "2030-03-04", "PM"));
  assert.ok(turnover.bid, turnover.error);

  const clash = await request(car.id, borrower.id, R("2030-03-04", "PM", "2030-03-05", "AM"));
  assert.match(clash.error ?? "", /overlap an existing booking/);
  assert.match(clash.error ?? "", /Next free: 5 Mar AM → 5 Mar PM/);
  assert.deepEqual(clash.nextFree, R("2030-03-05", "AM", "2030-03-05", "PM"));
});

test("existing whole-day bookings default to AM start / PM end and still block their whole days", async () => {
  const { car, borrower } = await setupShared();
  const legacy = await Bookings.create({ vehicleId: car.id, borrowerId: borrower.id, startDate: "2030-04-01", endDate: "2030-04-02", status: "APPROVED" });
  const row = await Bookings.byId(legacy);
  assert.equal(row?.startHalf, "AM");
  assert.equal(row?.endHalf, "PM");
  assert.ok((await request(car.id, borrower.id, R("2030-04-02", "PM", "2030-04-02", "PM"))).error);
  assert.ok((await request(car.id, borrower.id, R("2030-04-03", "AM", "2030-04-03", "PM"))).bid);
});

/* ---------- owner blocks vs bookings, both ways ---------- */
test("a booking request overlapping an owner block is refused", async () => {
  const { car, owner, borrower } = await setupShared();
  const block = await addBlockAtomic({ vehicleId: car.id, ownerId: owner.id, ...R("2030-05-10", "AM", "2030-05-12", "AM"), reason: "Service" });
  assert.equal(block.ok, true);
  const res = await request(car.id, borrower.id, R("2030-05-11", "AM", "2030-05-11", "PM"));
  assert.match(res.error ?? "", /owner has blocked/);
  assert.ok((await request(car.id, borrower.id, R("2030-05-12", "PM", "2030-05-13", "PM"))).bid);
});

test("a block overlapping a PENDING or APPROVED booking is refused and names the booking", async () => {
  for (const requireApproval of [true, false]) {
    const { car, owner, borrower } = await setupShared(requireApproval);
    const b = await request(car.id, borrower.id, R("2030-06-01", "PM", "2030-06-02", "AM"));
    assert.ok(b.bid);
    const refused = await addBlockAtomic({ vehicleId: car.id, ownerId: owner.id, ...R("2030-06-02", "AM", "2030-06-02", "AM") });
    assert.deepEqual(refused, { ok: false, error: "Those dates overlap a booking. Cancel or decline it first.", bookingId: b.bid });
    assert.equal((await Blocks.forVehicle(car.id)).length, 0);

    // Around the booking's halves is fine.
    assert.equal((await addBlockAtomic({ vehicleId: car.id, ownerId: owner.id, ...R("2030-06-02", "PM", "2030-06-02", "PM") })).ok, true);
    // Once cancelled, the booking no longer blocks.
    await cancelBookingAtomic(b.bid!, owner.id);
    assert.equal((await addBlockAtomic({ vehicleId: car.id, ownerId: owner.id, ...R("2030-06-01", "AM", "2030-06-02", "AM") })).ok, true);
  }
});

test("blocks can't overlap each other, start in the past, or be managed by non-owners", async () => {
  const { car, owner, borrower } = await setupShared();
  const ok = await addBlockAtomic({ vehicleId: car.id, ownerId: owner.id, ...R("2030-07-01", "AM", "2030-07-02", "PM") });
  assert.equal(ok.ok, true);
  assert.equal((await addBlockAtomic({ vehicleId: car.id, ownerId: owner.id, ...R("2030-07-02", "PM", "2030-07-03", "PM") })).ok, false);
  assert.equal((await addBlockAtomic({ vehicleId: car.id, ownerId: owner.id, ...R("2000-01-01", "AM", "2000-01-01", "PM") })).ok, false);
  assert.equal((await addBlockAtomic({ vehicleId: car.id, ownerId: borrower.id, ...R("2030-08-01", "AM", "2030-08-01", "PM") })).ok, false);

  const blockId = ok.ok ? ok.id : "";
  assert.equal(await Blocks.remove(blockId, borrower.id), undefined);
  assert.equal((await Blocks.forVehicle(car.id)).length, 1);
  assert.equal(await Blocks.remove(blockId, owner.id), car.id);
  assert.equal((await Blocks.forVehicle(car.id)).length, 0);
});

/* ---------- lazy PENDING expiry ---------- */
test("a PENDING request unanswered for 48h stops blocking, reads EXPIRED, and can't be approved", async () => {
  const { car, borrower } = await setupShared(true);
  const old = await request(car.id, borrower.id, R("2030-09-01", "AM", "2030-09-02", "PM"));
  assert.equal(old.status, "PENDING");
  await run(`UPDATE "Booking" SET "createdAt" = now() - interval '49 hours' WHERE id = ?`, old.bid);

  assert.equal((await Bookings.byId(old.bid!))?.status, "EXPIRED");
  assert.equal(await Bookings.decide(old.bid!, "APPROVED"), false);
  assert.equal((await cancelBookingAtomic(old.bid!, borrower.id)).ok, false);
  assert.equal((await Calendar.busy([car.id], "2030-09-01")).length, 0);

  const fresh = await request(car.id, borrower.id, R("2030-09-01", "AM", "2030-09-01", "PM"));
  assert.ok(fresh.bid, fresh.error);
  // The write path persisted the expiry.
  const [raw] = await all<{ status: string }>(`SELECT status FROM "Booking" WHERE id = ?`, old.bid);
  assert.equal(raw.status, "EXPIRED");
  assert.equal(await Bookings.decide(fresh.bid!, "APPROVED"), true);
});

test("a PENDING request whose start date has passed reads EXPIRED and doesn't block deleting the car", async () => {
  const { car, owner, borrower } = await setupShared(true);
  const past = await Bookings.create({ vehicleId: car.id, borrowerId: borrower.id, startDate: "2001-01-01", endDate: "2031-01-01", status: "PENDING" });
  assert.equal((await Bookings.byId(past))?.status, "EXPIRED");
  assert.deepEqual(await deleteVehicleAtomic(car.id, owner.id), { ok: true });
});

/* ---------- access ---------- */
test("the club timeline only shows cars shared into that club, with borrower names", async () => {
  const { car, owner, borrower, club } = await setupShared();
  const otherCar = await Vehicles.create({ ownerId: owner.id, make: "Fiat", model: "Dino", year: 1969 });
  const otherClub = await Clubs.create(owner.id, `Other${n}`);
  await Memberships.add(otherClub.id, borrower.id);
  await shareVehicleAtomic(otherCar.id, otherClub.id, false);
  await request(car.id, borrower.id, R("2030-10-01", "AM", "2030-10-01", "PM"));
  await request(otherCar.id, borrower.id, R("2030-10-01", "AM", "2030-10-01", "PM"));

  const cars = await Shares.forClub(club.id);
  const entries = await Calendar.busy(cars.map((c) => c.id), "2030-10-01", "2030-10-14");
  assert.deepEqual(cars.map((c) => c.id), [car.id]);
  assert.deepEqual(entries.map((e) => [e.vehicleId, e.label]), [[car.id, borrower.name]]);
});

/* ---------- agenda / needs action ---------- */
test("buildAgenda derives needs-action items for owners and borrowers", () => {
  const base = { make: "M", model: "X", year: 1, ownerName: "o", borrowerName: "b", purpose: null, createdAt: "", vehicleId: "v",
    startHalf: "AM", endHalf: "PM", borrowerId: "bor", ownerId: "own", pickedUp: false, returned: false } as const;
  const row = (id: string, status: string, startDate: string, endDate: string, extra: Partial<AgendaRow> = {}) =>
    ({ ...base, id, status, startDate, endDate, ...extra }) as AgendaRow;
  const rows = [
    row("pending", "PENDING", "2030-01-10", "2030-01-11"),
    row("pickup", "APPROVED", "2030-01-05", "2030-01-06"),
    row("out", "APPROVED", "2030-01-01", "2030-01-08", { pickedUp: true }),
    row("return", "APPROVED", "2029-12-30", "2030-01-05", { pickedUp: true }),
    row("later", "APPROVED", "2030-02-01", "2030-02-02"),
    row("expired", "EXPIRED", "2030-01-10", "2030-01-11"),
  ];
  const owner = buildAgenda(rows, "own", "2030-01-05");
  assert.deepEqual(owner.needsAction.map((i) => [i.id, i.action]), [["pending", "DECIDE"], ["pickup", "PICKUP"], ["return", "RETURN"]]);
  assert.deepEqual(owner.upcoming.map((i) => i.id), ["out", "later"]);
  assert.deepEqual(owner.history.map((i) => i.id), ["expired"]);

  const borrower = buildAgenda(rows, "bor", "2030-01-05");
  assert.deepEqual(borrower.needsAction.map((i) => i.id), ["pickup", "return"]);
  assert.ok(borrower.upcoming.some((i) => i.id === "pending" && i.role === "BORROWER"));
});
