import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { resetDb, closeDb } from "./helpers/testdb";
import {
  Users, Vehicles, Clubs, Shares, Bookings, Handovers, Expenses, Timeline, Gallery, Documents,
  shareVehicleAtomic, deleteVehicleAtomic,
} from "../src/lib/repo";
import { all } from "../src/lib/db";

before(async () => { await resetDb(); });
after(async () => { await closeDb(); });

const mkUser = (email: string) => Users.create({ name: email.split("@")[0], email, passwordHash: "x" });
const mkCar = (ownerId: string) => Vehicles.create({ ownerId, make: "Porsche", model: "911", year: 1988 });
const book = (vehicleId: string, borrowerId: string, status: string, startDate = "2030-01-01", endDate = "2030-01-02") =>
  Bookings.create({ vehicleId, borrowerId, startDate, endDate, status });

test("blocks deletion while a pending or approved booking exists", async () => {
  for (const status of ["PENDING", "APPROVED"]) {
    const owner = await mkUser(`o-${status}@example.com`);
    const borrower = await mkUser(`b-${status}@example.com`);
    const car = await mkCar(owner.id);
    await book(car.id, borrower.id, status);

    const res = await deleteVehicleAtomic(car.id, owner.id);

    assert.equal(res.ok, false);
    assert.ok(!res.ok && res.blocking?.length === 1 && res.blocking[0].status === status);
    assert.ok(await Vehicles.byId(car.id));
  }
});

test("allows deletion when only completed, declined or cancelled bookings remain", async () => {
  const owner = await mkUser("o-past@example.com");
  const borrower = await mkUser("b-past@example.com");
  const car = await mkCar(owner.id);
  await book(car.id, borrower.id, "COMPLETED");
  await book(car.id, borrower.id, "DECLINED");
  await book(car.id, borrower.id, "CANCELLED");

  assert.deepEqual(await deleteVehicleAtomic(car.id, owner.id), { ok: true });
  assert.equal(await Vehicles.byId(car.id), undefined);
});

test("non-owner cannot delete someone else's car", async () => {
  const owner = await mkUser("o-own@example.com");
  const other = await mkUser("o-other@example.com");
  const car = await mkCar(owner.id);

  const res = await deleteVehicleAtomic(car.id, other.id);

  assert.equal(res.ok, false);
  assert.ok(await Vehicles.byId(car.id));
});

test("deleting removes club shares and all dependent rows", async () => {
  const owner = await mkUser("o-cascade@example.com");
  const borrower = await mkUser("b-cascade@example.com");
  const car = await mkCar(owner.id);
  const club = await Clubs.create(owner.id, "Cascade Club");
  await shareVehicleAtomic(car.id, club.id, true);
  const bid = await book(car.id, borrower.id, "COMPLETED");
  await Handovers.upsert(bid, { pickupMileageKm: 10 });
  await Expenses.create({ vehicleId: car.id, name: "Fuel", category: "Fuel", amount: 10 });
  await Timeline.create({ vehicleId: car.id, year: 1990, title: "t" });
  await Gallery.create({ vehicleId: car.id, url: "https://example.com/a.jpg" });
  await Documents.create({ vehicleId: car.id, name: "d", category: "Other", uploadedById: owner.id });

  assert.deepEqual(await deleteVehicleAtomic(car.id, owner.id), { ok: true });

  assert.equal((await Shares.forVehicle(car.id)).length, 0);
  for (const t of ["Booking", "Expense", "TimelineEvent", "GalleryImage", "Document"]) {
    assert.equal((await all(`SELECT 1 FROM "${t}" WHERE "vehicleId" = ?`, car.id)).length, 0, t);
  }
  assert.equal((await all('SELECT 1 FROM "HandoverLog" WHERE "bookingId" = ?', bid)).length, 0);
  assert.ok(await Clubs.bySlug(club.slug), "club itself survives");
});
