import { all, get, run, id } from "./db";
import type {
  User, Vehicle, Expense, DocumentRow, TimelineEvent, GalleryImage,
  Club, ClubMembership, VehicleShare, Booking, HandoverLog, Visibility,
} from "./types";

/* ---------------- Users ---------------- */
export const Users = {
  byId: (uid: string) => get<User>("SELECT * FROM User WHERE id = ?", uid),
  byEmail: (email: string) => get<User>("SELECT * FROM User WHERE email = ?", email),
  create(data: { name: string; email: string; passwordHash: string }) {
    const uid = id();
    run("INSERT INTO User (id, name, email, passwordHash) VALUES (?,?,?,?)", uid, data.name, data.email, data.passwordHash);
    return Users.byId(uid)!;
  },
  search: (q: string, excludeId: string) =>
    all<User>("SELECT * FROM User WHERE (email LIKE ? OR name LIKE ?) AND id != ? LIMIT 8", `%${q}%`, `%${q}%`, excludeId),
};

/* ---------------- Vehicles ---------------- */
export const Vehicles = {
  byId: (vid: string) => get<Vehicle>("SELECT * FROM Vehicle WHERE id = ?", vid),
  ownedBy: (uid: string) => all<Vehicle>("SELECT * FROM Vehicle WHERE ownerId = ? ORDER BY createdAt DESC", uid),
  forOwner: (vid: string, uid: string) => get<Vehicle>("SELECT * FROM Vehicle WHERE id = ? AND ownerId = ?", vid, uid),
  create(data: Partial<Vehicle> & { ownerId: string; make: string; model: string; year: number }) {
    const vid = id();
    run(
      `INSERT INTO Vehicle (id, ownerId, year, make, model, imageUrl, cylinders, performanceKw, mileageKm, color)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      vid, data.ownerId, data.year, data.make, data.model,
      data.imageUrl ?? null, data.cylinders ?? null, data.performanceKw ?? null,
      data.mileageKm ?? 0, data.color ?? null
    );
    return Vehicles.byId(vid)!;
  },
  updateSpecs(vid: string, d: Partial<Vehicle>) {
    run(
      `UPDATE Vehicle SET model=?, cylinders=?, performanceKw=?, mileageKm=?, color=?, vin=?, description=?, imageUrl=? WHERE id=?`,
      d.model, d.cylinders ?? null, d.performanceKw ?? null, d.mileageKm ?? 0,
      d.color ?? null, d.vin ?? null, d.description ?? null, d.imageUrl ?? null, vid
    );
  },
  updateTechnical(vid: string, d: Partial<Vehicle>) {
    run(
      `UPDATE Vehicle SET vehicleType=?, bodyStyle=?, previousOwners=?, unitsProduced=?,
       transmissionNumber=?, location=?, gearbox=?, driveType=?, driversSide=?, matchingNumbers=?, vin=? WHERE id=?`,
      d.vehicleType ?? null, d.bodyStyle ?? null, d.previousOwners ?? null, d.unitsProduced ?? null,
      d.transmissionNumber ?? null, d.location ?? null, d.gearbox ?? null, d.driveType ?? null,
      d.driversSide ?? null, d.matchingNumbers ?? 0, d.vin ?? null, vid
    );
  },
  updateFacts(vid: string, keyFacts: string | null, overview: string | null) {
    run("UPDATE Vehicle SET keyFacts=?, overview=? WHERE id=?", keyFacts, overview, vid);
  },
  setVisibility: (vid: string, v: Visibility) => run("UPDATE Vehicle SET visibility=? WHERE id=?", v, vid),
  setImage: (vid: string, url: string) => run("UPDATE Vehicle SET imageUrl=? WHERE id=?", url, vid),
  remove: (vid: string, uid: string) => run("DELETE FROM Vehicle WHERE id=? AND ownerId=?", vid, uid),
  shareCount: (vid: string) => get<{ c: number }>("SELECT COUNT(*) c FROM VehicleShare WHERE vehicleId=?", vid)!.c,
};

/* ---------------- Expenses ---------------- */
export const Expenses = {
  forVehicle: (vid: string) => all<Expense>("SELECT * FROM Expense WHERE vehicleId=? ORDER BY date DESC", vid),
  create(d: { vehicleId: string; name: string; category: string; type?: string; amount: number; date?: string; notes?: string }) {
    const eid = id();
    run(
      "INSERT INTO Expense (id, vehicleId, name, category, type, amount, date, notes) VALUES (?,?,?,?,?,?,?,?)",
      eid, d.vehicleId, d.name, d.category, d.type ?? "QUICK COST", d.amount,
      d.date ?? new Date().toISOString(), d.notes ?? null
    );
    return eid;
  },
  remove: (eid: string, vid: string) => run("DELETE FROM Expense WHERE id=? AND vehicleId=?", eid, vid),
};

/* ---------------- Documents ---------------- */
export const Documents = {
  forVehicle: (vid: string) =>
    all<DocumentRow & { uploaderName: string | null }>(
      `SELECT d.*, u.name AS uploaderName FROM Document d
       LEFT JOIN User u ON u.id = d.uploadedById
       WHERE d.vehicleId=? ORDER BY d.createdAt DESC`, vid),
  create(d: { vehicleId: string; name: string; category: string; type?: string; fileUrl?: string; uploadedById: string }) {
    const did = id();
    run(
      "INSERT INTO Document (id, vehicleId, name, category, type, fileUrl, uploadedById) VALUES (?,?,?,?,?,?,?)",
      did, d.vehicleId, d.name, d.category, d.type ?? "PDF", d.fileUrl ?? null, d.uploadedById
    );
    return did;
  },
  remove: (did: string, vid: string) => run("DELETE FROM Document WHERE id=? AND vehicleId=?", did, vid),
};

/* ---------------- Timeline ---------------- */
export const Timeline = {
  forVehicle: (vid: string) => all<TimelineEvent>("SELECT * FROM TimelineEvent WHERE vehicleId=? ORDER BY year ASC, createdAt ASC", vid),
  create(d: { vehicleId: string; year: number; title: string; description?: string; imageUrl?: string; category?: string; eventDate?: string }) {
    const tid = id();
    run("INSERT INTO TimelineEvent (id, vehicleId, year, title, description, imageUrl, category, eventDate) VALUES (?,?,?,?,?,?,?,?)",
      tid, d.vehicleId, d.year, d.title, d.description ?? null, d.imageUrl ?? null, d.category ?? "HISTORY", d.eventDate ?? null);
    return tid;
  },
  remove: (tid: string, vid: string) => run("DELETE FROM TimelineEvent WHERE id=? AND vehicleId=?", tid, vid),
  // Events with a future date — surfaced on the profile as "Upcoming events".
  upcoming: (vid: string) =>
    all<TimelineEvent>(
      "SELECT * FROM TimelineEvent WHERE vehicleId=? AND eventDate IS NOT NULL AND date(eventDate) >= date('now') ORDER BY date(eventDate) ASC", vid),
  stats(vid: string) {
    const rows = all<{ category: string; c: number }>(
      "SELECT category, COUNT(*) c FROM TimelineEvent WHERE vehicleId=? GROUP BY category", vid);
    const base: Record<string, number> = { SERVICE: 0, RESTORATION: 0, ADMIN: 0, HISTORY: 0 };
    for (const r of rows) base[r.category] = r.c;
    return base;
  },
};

/* ---------------- Gallery ---------------- */
export const Gallery = {
  forVehicle: (vid: string) => all<GalleryImage>("SELECT * FROM GalleryImage WHERE vehicleId=? ORDER BY createdAt DESC", vid),
  create: (d: { vehicleId: string; url: string; caption?: string }) => {
    const gid = id();
    run("INSERT INTO GalleryImage (id, vehicleId, url, caption) VALUES (?,?,?,?)", gid, d.vehicleId, d.url, d.caption ?? null);
    return gid;
  },
  remove: (gid: string, vid: string) => run("DELETE FROM GalleryImage WHERE id=? AND vehicleId=?", gid, vid),
};

/* ---------------- Clubs ---------------- */
function code() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
export const Clubs = {
  byId: (cid: string) => get<Club>("SELECT * FROM Club WHERE id=?", cid),
  byInvite: (c: string) => get<Club>("SELECT * FROM Club WHERE inviteCode=?", c),
  forUser: (uid: string) =>
    all<Club & { memberCount: number; role: string }>(
      `SELECT c.*, m.role AS role,
        (SELECT COUNT(*) FROM ClubMembership mm WHERE mm.clubId = c.id) AS memberCount
       FROM Club c JOIN ClubMembership m ON m.clubId = c.id
       WHERE m.userId = ? ORDER BY c.createdAt DESC`, uid),
  create(ownerId: string, name: string, description?: string) {
    const cid = id();
    run("INSERT INTO Club (id, name, description, ownerId, inviteCode) VALUES (?,?,?,?,?)", cid, name, description ?? null, ownerId, code());
    Memberships.add(cid, ownerId, "OWNER");
    return Clubs.byId(cid)!;
  },
};

export const Memberships = {
  forClub: (cid: string) =>
    all<ClubMembership & { name: string; email: string }>(
      `SELECT m.*, u.name, u.email FROM ClubMembership m JOIN User u ON u.id = m.userId
       WHERE m.clubId = ? ORDER BY m.joinedAt ASC`, cid),
  of: (cid: string, uid: string) => get<ClubMembership>("SELECT * FROM ClubMembership WHERE clubId=? AND userId=?", cid, uid),
  add(cid: string, uid: string, role: "OWNER" | "ADMIN" | "MEMBER" = "MEMBER") {
    const existing = Memberships.of(cid, uid);
    if (existing) return existing.id;
    const mid = id();
    run("INSERT INTO ClubMembership (id, clubId, userId, role) VALUES (?,?,?,?)", mid, cid, uid, role);
    return mid;
  },
  remove: (cid: string, uid: string) => run("DELETE FROM ClubMembership WHERE clubId=? AND userId=? AND role != 'OWNER'", cid, uid),
};

/* ---------------- Shares ---------------- */
export const Shares = {
  forClub: (cid: string) =>
    all<VehicleShare & Vehicle & { ownerName: string }>(
      `SELECT s.id AS shareId, s.requireApproval, v.*, u.name AS ownerName
       FROM VehicleShare s JOIN Vehicle v ON v.id = s.vehicleId JOIN User u ON u.id = v.ownerId
       WHERE s.clubId = ? ORDER BY v.make, v.model`, cid) as any[],
  forVehicle: (vid: string) =>
    all<{ shareId: string; clubId: string; clubName: string; requireApproval: number }>(
      `SELECT s.id AS shareId, s.clubId, c.name AS clubName, s.requireApproval
       FROM VehicleShare s JOIN Club c ON c.id = s.clubId WHERE s.vehicleId = ?`, vid),
  add(vehicleId: string, clubId: string, requireApproval: boolean) {
    const sid = id();
    run("INSERT OR IGNORE INTO VehicleShare (id, vehicleId, clubId, requireApproval) VALUES (?,?,?,?)", sid, vehicleId, clubId, requireApproval ? 1 : 0);
    return sid;
  },
  remove: (vehicleId: string, clubId: string) => run("DELETE FROM VehicleShare WHERE vehicleId=? AND clubId=?", vehicleId, clubId),
  // Vehicles bookable by a user (shared into any club they belong to, not their own)
  bookableFor: (uid: string) =>
    all<Vehicle & { ownerName: string; clubName: string; requireApproval: number; shareId: string }>(
      `SELECT DISTINCT v.*, u.name AS ownerName, c.name AS clubName, s.requireApproval, s.id AS shareId
       FROM VehicleShare s
       JOIN Vehicle v ON v.id = s.vehicleId
       JOIN User u ON u.id = v.ownerId
       JOIN Club c ON c.id = s.clubId
       JOIN ClubMembership m ON m.clubId = c.id AND m.userId = ?
       WHERE v.ownerId != ?
       ORDER BY v.make, v.model`, uid, uid),
  isBookableBy(vehicleId: string, uid: string) {
    return get<{ requireApproval: number }>(
      `SELECT s.requireApproval FROM VehicleShare s
       JOIN ClubMembership m ON m.clubId = s.clubId AND m.userId = ?
       WHERE s.vehicleId = ? LIMIT 1`, uid, vehicleId);
  },
};

/* ---------------- Bookings ---------------- */
export const Bookings = {
  byId: (bid: string) => get<Booking>("SELECT * FROM Booking WHERE id=?", bid),
  forVehicle: (vid: string) =>
    all<Booking & { borrowerName: string }>(
      `SELECT b.*, u.name AS borrowerName FROM Booking b JOIN User u ON u.id = b.borrowerId
       WHERE b.vehicleId = ? ORDER BY b.startDate DESC`, vid),
  activeForVehicle: (vid: string) =>
    all<Booking & { borrowerName: string }>(
      `SELECT b.*, u.name AS borrowerName FROM Booking b JOIN User u ON u.id = b.borrowerId
       WHERE b.vehicleId = ? AND b.status IN ('PENDING','APPROVED') ORDER BY b.startDate ASC`, vid),
  byBorrower: (uid: string) =>
    all<Booking & { make: string; model: string; year: number; imageUrl: string | null; ownerName: string }>(
      `SELECT b.*, v.make, v.model, v.year, v.imageUrl, u.name AS ownerName
       FROM Booking b JOIN Vehicle v ON v.id = b.vehicleId JOIN User u ON u.id = v.ownerId
       WHERE b.borrowerId = ? ORDER BY b.startDate DESC`, uid),
  // Booking requests on vehicles owned by uid
  incomingFor: (uid: string) =>
    all<Booking & { borrowerName: string; make: string; model: string; year: number }>(
      `SELECT b.*, u.name AS borrowerName, v.make, v.model, v.year
       FROM Booking b JOIN Vehicle v ON v.id = b.vehicleId JOIN User u ON u.id = b.borrowerId
       WHERE v.ownerId = ? ORDER BY b.createdAt DESC`, uid),
  overlapping: (vehicleId: string, startDate: string, endDate: string) =>
    all<Booking>(
      `SELECT * FROM Booking WHERE vehicleId=? AND status IN ('PENDING','APPROVED')
       AND date(startDate) <= date(?) AND date(?) <= date(endDate)`, vehicleId, endDate, startDate),
  create(d: { vehicleId: string; borrowerId: string; startDate: string; endDate: string; status: string; purpose?: string }) {
    const bid = id();
    run("INSERT INTO Booking (id, vehicleId, borrowerId, startDate, endDate, status, purpose) VALUES (?,?,?,?,?,?,?)",
      bid, d.vehicleId, d.borrowerId, d.startDate, d.endDate, d.status, d.purpose ?? null);
    return bid;
  },
  setStatus: (bid: string, status: string) => run("UPDATE Booking SET status=? WHERE id=?", status, bid),
};

/* ---------------- Handover ---------------- */
export const Handovers = {
  forBooking: (bid: string) => get<HandoverLog>("SELECT * FROM HandoverLog WHERE bookingId=?", bid),
  upsert(bid: string, d: Partial<HandoverLog>) {
    const existing = Handovers.forBooking(bid);
    if (existing) {
      run(
        `UPDATE HandoverLog SET pickupMileageKm=?, returnMileageKm=?, pickupFuelPct=?, returnFuelPct=?,
         conditionNotes=?, damageReported=?, checklistJson=?, pickedUpAt=?, returnedAt=?, updatedAt=datetime('now') WHERE bookingId=?`,
        d.pickupMileageKm ?? existing.pickupMileageKm, d.returnMileageKm ?? existing.returnMileageKm,
        d.pickupFuelPct ?? existing.pickupFuelPct, d.returnFuelPct ?? existing.returnFuelPct,
        d.conditionNotes ?? existing.conditionNotes, d.damageReported ?? existing.damageReported,
        d.checklistJson ?? existing.checklistJson, d.pickedUpAt ?? existing.pickedUpAt,
        d.returnedAt ?? existing.returnedAt, bid
      );
    } else {
      run(
        `INSERT INTO HandoverLog (id, bookingId, pickupMileageKm, returnMileageKm, pickupFuelPct, returnFuelPct,
         conditionNotes, damageReported, checklistJson, pickedUpAt, returnedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        id(), bid, d.pickupMileageKm ?? null, d.returnMileageKm ?? null, d.pickupFuelPct ?? null, d.returnFuelPct ?? null,
        d.conditionNotes ?? null, d.damageReported ?? 0, d.checklistJson ?? null, d.pickedUpAt ?? null, d.returnedAt ?? null
      );
    }
  },
};

/* ---------------- Aggregates ---------------- */
export function categoryTotals(vehicleId: string) {
  return all<{ category: string; total: number }>(
    "SELECT category, SUM(amount) total FROM Expense WHERE vehicleId=? GROUP BY category ORDER BY total DESC", vehicleId);
}
export function categoryTotalsForOwner(uid: string) {
  return all<{ category: string; total: number }>(
    `SELECT e.category, SUM(e.amount) total FROM Expense e JOIN Vehicle v ON v.id = e.vehicleId
     WHERE v.ownerId = ? GROUP BY e.category ORDER BY total DESC`, uid);
}
export function vehicleCostTotals(uid: string) {
  return all<{ vehicleId: string; total: number }>(
    `SELECT e.vehicleId, SUM(e.amount) total FROM Expense e JOIN Vehicle v ON v.id = e.vehicleId
     WHERE v.ownerId = ? GROUP BY e.vehicleId`, uid);
}
