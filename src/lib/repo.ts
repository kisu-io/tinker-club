import { all, get, run, id, tx, conn } from "./db";
import type postgres from "postgres";
import { uniqueSlug } from "./slug";
import type {
  User, Vehicle, Expense, DocumentRow, TimelineEvent, GalleryImage,
  Club, ClubMembership, VehicleShare, Booking, HandoverLog, Visibility,
} from "./types";

type Sql = ReturnType<typeof postgres>;

/* ---------------- Users ---------------- */
export const Users = {
  byId: async (uid: string) => get<User>('SELECT * FROM "User" WHERE id = ?', uid),
  byEmail: async (email: string) => get<User>('SELECT * FROM "User" WHERE email = ?', email),
  async create(data: { name: string; email: string; passwordHash: string }) {
    const uid = id();
    await run('INSERT INTO "User" (id, name, email, "passwordHash") VALUES (?,?,?,?)', uid, data.name, data.email, data.passwordHash);
    return (await Users.byId(uid))!;
  },
  search: async (q: string, excludeId: string) =>
    all<User>('SELECT * FROM "User" WHERE (email LIKE ? OR name LIKE ?) AND id != ? LIMIT 8', `%${q}%`, `%${q}%`, excludeId),
};

/* ---------------- Vehicles ---------------- */
export const Vehicles = {
  byId: async (vid: string) => get<Vehicle>('SELECT * FROM "Vehicle" WHERE id = ?', vid),
  ownedBy: async (uid: string) => all<Vehicle>('SELECT * FROM "Vehicle" WHERE "ownerId" = ? ORDER BY "createdAt" DESC', uid),
  forOwner: async (vid: string, uid: string) => get<Vehicle>('SELECT * FROM "Vehicle" WHERE id = ? AND "ownerId" = ?', vid, uid),
  async create(data: Partial<Vehicle> & { ownerId: string; make: string; model: string; year: number }) {
    const vid = id();
    await run(
      `INSERT INTO "Vehicle" (id, "ownerId", year, make, model, "imageUrl", cylinders, "performanceKw", "mileageKm", color)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      vid, data.ownerId, data.year, data.make, data.model,
      data.imageUrl ?? null, data.cylinders ?? null, data.performanceKw ?? null,
      data.mileageKm ?? 0, data.color ?? null
    );
    return (await Vehicles.byId(vid))!;
  },
  updateSpecs: async (vid: string, d: Partial<Vehicle>) => {
    await run(
      `UPDATE "Vehicle" SET model=?, cylinders=?, "performanceKw"=?, "mileageKm"=?, color=?, vin=?, description=?, "imageUrl"=? WHERE id=?`,
      d.model, d.cylinders ?? null, d.performanceKw ?? null, d.mileageKm ?? 0,
      d.color ?? null, d.vin ?? null, d.description ?? null, d.imageUrl ?? null, vid
    );
  },
  updateTechnical: async (vid: string, d: Partial<Vehicle>) => {
    await run(
      `UPDATE "Vehicle" SET "vehicleType"=?, "bodyStyle"=?, "previousOwners"=?, "unitsProduced"=?,
       "transmissionNumber"=?, location=?, gearbox=?, "driveType"=?, "driversSide"=?, "matchingNumbers"=?, vin=? WHERE id=?`,
      d.vehicleType ?? null, d.bodyStyle ?? null, d.previousOwners ?? null, d.unitsProduced ?? null,
      d.transmissionNumber ?? null, d.location ?? null, d.gearbox ?? null, d.driveType ?? null,
      d.driversSide ?? null, d.matchingNumbers ?? 0, d.vin ?? null, vid
    );
  },
  updateFacts: async (vid: string, keyFacts: string | null, overview: string | null) => {
    await run('UPDATE "Vehicle" SET "keyFacts"=?, overview=? WHERE id=?', keyFacts, overview, vid);
  },
  setVisibility: async (vid: string, v: Visibility) => run('UPDATE "Vehicle" SET visibility=? WHERE id=?', v, vid),
  setImage: async (vid: string, url: string) => run('UPDATE "Vehicle" SET "imageUrl"=? WHERE id=?', url, vid),
  shareCount: async (vid: string) => (await get<{ c: number }>('SELECT COUNT(*) c FROM "VehicleShare" WHERE "vehicleId"=?', vid))?.c ?? 0,
  /** Bulk fetch share counts for many vehicles in one query (avoids N+1). */
  shareCounts: async (vids: string[]): Promise<Record<string, number>> => {
    if (!vids.length) return {};
    const placeholders = vids.map((_, i) => `$${i + 1}`).join(",");
    const rows = await all<{ vehicleId: string; c: number }>(
      `SELECT "vehicleId", COUNT(*) c FROM "VehicleShare" WHERE "vehicleId" IN (${placeholders}) GROUP BY "vehicleId"`,
      ...vids,
    );
    const map: Record<string, number> = {};
    for (const r of rows) map[r.vehicleId] = r.c;
    return map;
  },
};

/* ---------------- Expenses ---------------- */
export const Expenses = {
  forVehicle: async (vid: string) => all<Expense>('SELECT * FROM "Expense" WHERE "vehicleId"=? ORDER BY date DESC', vid),
  async create(d: { vehicleId: string; name: string; category: string; type?: string; amount: number; date?: string; notes?: string }) {
    const eid = id();
    await run(
      'INSERT INTO "Expense" (id, "vehicleId", name, category, type, amount, date, notes) VALUES (?,?,?,?,?,?,?,?)',
      eid, d.vehicleId, d.name, d.category, d.type ?? "QUICK COST", d.amount,
      d.date ?? new Date().toISOString(), d.notes ?? null
    );
    return eid;
  },
  remove: async (eid: string, vid: string) => run('DELETE FROM "Expense" WHERE id=? AND "vehicleId"=?', eid, vid),
};

/* ---------------- Documents ---------------- */
export const Documents = {
  forVehicle: async (vid: string) =>
    all<DocumentRow & { uploaderName: string | null }>(
      `SELECT d.*, u.name AS "uploaderName" FROM "Document" d
       LEFT JOIN "User" u ON u.id = d."uploadedById"
       WHERE d."vehicleId"=? ORDER BY d."createdAt" DESC`, vid),
  async create(d: { vehicleId: string; name: string; category: string; type?: string; fileUrl?: string; uploadedById: string }) {
    const did = id();
    await run(
      'INSERT INTO "Document" (id, "vehicleId", name, category, type, "fileUrl", "uploadedById") VALUES (?,?,?,?,?,?,?)',
      did, d.vehicleId, d.name, d.category, d.type ?? "PDF", d.fileUrl ?? null, d.uploadedById
    );
    return did;
  },
  remove: async (did: string, vid: string) => run('DELETE FROM "Document" WHERE id=? AND "vehicleId"=?', did, vid),
};

/* ---------------- Timeline ---------------- */
export const Timeline = {
  forVehicle: async (vid: string) => all<TimelineEvent>('SELECT * FROM "TimelineEvent" WHERE "vehicleId"=? ORDER BY year ASC, "createdAt" ASC', vid),
  async create(d: { vehicleId: string; year: number; title: string; description?: string; imageUrl?: string; category?: string; eventDate?: string }) {
    const tid = id();
    await run('INSERT INTO "TimelineEvent" (id, "vehicleId", year, title, description, "imageUrl", category, "eventDate") VALUES (?,?,?,?,?,?,?,?)',
      tid, d.vehicleId, d.year, d.title, d.description ?? null, d.imageUrl ?? null, d.category ?? "HISTORY", d.eventDate ?? null);
    return tid;
  },
  remove: async (tid: string, vid: string) => run('DELETE FROM "TimelineEvent" WHERE id=? AND "vehicleId"=?', tid, vid),
  // Events with a future date — surfaced on the profile as "Upcoming events".
  upcoming: async (vid: string) =>
    all<TimelineEvent>(
      'SELECT * FROM "TimelineEvent" WHERE "vehicleId"=? AND "eventDate" IS NOT NULL AND "eventDate"::date >= CURRENT_DATE ORDER BY "eventDate"::date ASC', vid),
  stats: async (vid: string) => {
    const rows = await all<{ category: string; c: number }>(
      'SELECT category, COUNT(*) c FROM "TimelineEvent" WHERE "vehicleId"=? GROUP BY category', vid);
    const base: Record<string, number> = { SERVICE: 0, RESTORATION: 0, ADMIN: 0, HISTORY: 0 };
    for (const r of rows) base[r.category] = r.c;
    return base;
  },
};

/* ---------------- Gallery ---------------- */
export const Gallery = {
  forVehicle: async (vid: string) => all<GalleryImage>('SELECT * FROM "GalleryImage" WHERE "vehicleId"=? ORDER BY "createdAt" DESC', vid),
  create: async (d: { vehicleId: string; url: string; caption?: string }) => {
    const gid = id();
    await run('INSERT INTO "GalleryImage" (id, "vehicleId", url, caption) VALUES (?,?,?,?)', gid, d.vehicleId, d.url, d.caption ?? null);
    return gid;
  },
  remove: async (gid: string, vid: string) => run('DELETE FROM "GalleryImage" WHERE id=? AND "vehicleId"=?', gid, vid),
};

/* ---------------- Clubs ---------------- */
function code() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
export const Clubs = {
  byId: async (cid: string) => get<Club>('SELECT * FROM "Club" WHERE id=?', cid),
  bySlug: async (slug: string) => get<Club>('SELECT * FROM "Club" WHERE slug=?', slug),
  byInvite: async (c: string) => get<Club>('SELECT * FROM "Club" WHERE "inviteCode"=?', c),
  slugExists: async (slug: string) => !!(await get<{ x: number }>('SELECT 1 x FROM "Club" WHERE slug=?', slug)),
  forUser: async (uid: string) =>
    all<Club & { memberCount: number; role: string }>(
      `SELECT c.*, m.role AS role,
        (SELECT COUNT(*) FROM "ClubMembership" mm WHERE mm."clubId" = c.id) AS "memberCount"
       FROM "Club" c JOIN "ClubMembership" m ON m."clubId" = c.id
       WHERE m."userId" = ? ORDER BY c."createdAt" DESC`, uid),
  async create(
    ownerId: string,
    name: string,
    opts: {
      description?: string;
      slug?: string;
      primaryColor?: string;
      accentColor?: string;
      logoUrl?: string;
      tagline?: string;
    } = {},
  ) {
    const cid = id();
    // Uniqueness is enforced here in one place: slugify happens inside uniqueSlug,
    // and it probes slugExists so a caller-supplied slug still can't collide.
    const slug = await uniqueSlug(opts.slug ?? name, Clubs.slugExists);
    await run(
      `INSERT INTO "Club" (id, name, description, "ownerId", "inviteCode", slug, "primaryColor", "accentColor", "logoUrl", tagline)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      cid, name, opts.description ?? null, ownerId, code(), slug,
      opts.primaryColor ?? null, opts.accentColor ?? null, opts.logoUrl ?? null, opts.tagline ?? null,
    );
    await Memberships.add(cid, ownerId, "OWNER");
    return (await Clubs.byId(cid))!;
  },
};

export const Memberships = {
  forClub: async (cid: string) =>
    all<ClubMembership & { name: string; email: string }>(
      `SELECT m.*, u.name, u.email FROM "ClubMembership" m JOIN "User" u ON u.id = m."userId"
       WHERE m."clubId" = ? ORDER BY m."joinedAt" ASC`, cid),
  of: async (cid: string, uid: string) => get<ClubMembership>('SELECT * FROM "ClubMembership" WHERE "clubId"=? AND "userId"=?', cid, uid),
  async add(cid: string, uid: string, role: "OWNER" | "ADMIN" | "MEMBER" = "MEMBER") {
    const existing = await Memberships.of(cid, uid);
    if (existing) return existing.id;
    const mid = id();
    await run('INSERT INTO "ClubMembership" (id, "clubId", "userId", role) VALUES (?,?,?,?)', mid, cid, uid, role);
    return mid;
  },
  remove: async (cid: string, uid: string) => run('DELETE FROM "ClubMembership" WHERE "clubId"=? AND "userId"=? AND role != ?', cid, uid, "OWNER"),
};

/* ---------------- Shares ---------------- */
export const Shares = {
  forClub: async (cid: string) =>
    (await all<VehicleShare & Vehicle & { ownerName: string }>(
      `SELECT s.id AS "shareId", s."requireApproval", v.*, u.name AS "ownerName"
       FROM "VehicleShare" s JOIN "Vehicle" v ON v.id = s."vehicleId" JOIN "User" u ON u.id = v."ownerId"
       WHERE s."clubId" = ? ORDER BY v.make, v.model`, cid)) as unknown as any[],
  forVehicle: async (vid: string) =>
    all<{ shareId: string; clubId: string; clubName: string; requireApproval: number }>(
      `SELECT s.id AS "shareId", s."clubId", c.name AS "clubName", s."requireApproval"
       FROM "VehicleShare" s JOIN "Club" c ON c.id = s."clubId" WHERE s."vehicleId" = ?`, vid),
  async add(vehicleId: string, clubId: string, requireApproval: boolean) {
    const sid = id();
    await run('INSERT INTO "VehicleShare" (id, "vehicleId", "clubId", "requireApproval") VALUES (?,?,?,?) ON CONFLICT DO NOTHING', sid, vehicleId, clubId, requireApproval ? 1 : 0);
    return sid;
  },
  remove: async (vehicleId: string, clubId: string) => run('DELETE FROM "VehicleShare" WHERE "vehicleId"=? AND "clubId"=?', vehicleId, clubId),
  // Vehicles bookable by a user (shared into any club they belong to, not their own)
  bookableFor: async (uid: string) =>
    all<Vehicle & { ownerName: string; clubName: string; requireApproval: number; shareId: string }>(
      `SELECT DISTINCT v.*, u.name AS "ownerName", c.name AS "clubName", s."requireApproval", s.id AS "shareId"
       FROM "VehicleShare" s
       JOIN "Vehicle" v ON v.id = s."vehicleId"
       JOIN "User" u ON u.id = v."ownerId"
       JOIN "Club" c ON c.id = s."clubId"
       JOIN "ClubMembership" m ON m."clubId" = c.id AND m."userId" = ?
       WHERE v."ownerId" != ?
       ORDER BY v.make, v.model`, uid, uid),
  // Instant (0) if any of the user's clubs sharing the car grants instant booking.
  isBookableBy: async (vehicleId: string, uid: string) =>
    get<{ requireApproval: number }>(
      `SELECT MIN(s."requireApproval") AS "requireApproval" FROM "VehicleShare" s
       JOIN "ClubMembership" m ON m."clubId" = s."clubId" AND m."userId" = ?
       WHERE s."vehicleId" = ? HAVING COUNT(*) > 0`, uid, vehicleId),
};

/** The earliest calendar date that is "today" anywhere (UTC-12), so no timezone sees its own today as past. */
export function earliestToday(): string {
  return new Date(Date.now() - 12 * 3600_000).toISOString().slice(0, 10);
}

/**
 * Cancel future, not-yet-picked-up PENDING/APPROVED bookings whose borrower no longer reaches the
 * car through any club share. `scope` narrows to one vehicle or one borrower.
 */
async function cancelOrphanedBookings(sql: Sql, scope: { vehicleId: string } | { borrowerId: string }) {
  const where = "vehicleId" in scope ? sql`b."vehicleId" = ${scope.vehicleId}` : sql`b."borrowerId" = ${scope.borrowerId}`;
  await sql`UPDATE "Booking" b SET status = 'CANCELLED'
    WHERE ${where}
      AND b.status IN ('PENDING','APPROVED')
      AND b."startDate"::date >= ${earliestToday()}::date
      AND NOT EXISTS (SELECT 1 FROM "HandoverLog" h WHERE h."bookingId" = b.id AND h."pickedUpAt" IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM "VehicleShare" s
        JOIN "ClubMembership" m ON m."clubId" = s."clubId" AND m."userId" = b."borrowerId"
        WHERE s."vehicleId" = b."vehicleId")`;
}

/** Leave a club (the OWNER membership is never removed) and drop bookings that lost access. */
export async function leaveClubAtomic(clubId: string, userId: string): Promise<void> {
  await tx(async (sql) => {
    await sql`DELETE FROM "ClubMembership" WHERE "clubId" = ${clubId} AND "userId" = ${userId} AND role != 'OWNER'`;
    await cancelOrphanedBookings(sql, { borrowerId: userId });
  });
}

/** Atomic share + visibility flip. If the car is PRIVATE, sets it to CLUB. */
export async function shareVehicleAtomic(vehicleId: string, clubId: string, requireApproval: boolean): Promise<void> {
  const sid = id();
  await tx(async (sql) => {
    await sql`INSERT INTO "VehicleShare" (id, "vehicleId", "clubId", "requireApproval") VALUES (${sid}, ${vehicleId}, ${clubId}, ${requireApproval ? 1 : 0}) ON CONFLICT DO NOTHING`;
    await sql`UPDATE "Vehicle" SET visibility = 'CLUB' WHERE id = ${vehicleId} AND visibility = 'PRIVATE'`;
  });
}

/** Atomic unshare + visibility flip back to PRIVATE when no shares remain + drop bookings that lost access. */
export async function unshareVehicleAtomic(vehicleId: string, clubId: string): Promise<void> {
  await tx(async (sql) => {
    await sql`SELECT 1 FROM "Vehicle" WHERE id = ${vehicleId} FOR UPDATE`; // serialize with requestBookingAtomic
    await sql`DELETE FROM "VehicleShare" WHERE "vehicleId" = ${vehicleId} AND "clubId" = ${clubId}`;
    await sql`UPDATE "Vehicle" SET visibility = 'PRIVATE'
      WHERE id = ${vehicleId} AND visibility = 'CLUB'
      AND NOT EXISTS (SELECT 1 FROM "VehicleShare" WHERE "vehicleId" = ${vehicleId})`;
    await cancelOrphanedBookings(sql, { vehicleId });
  });
}

export type BlockingBooking = Pick<Booking, "id" | "startDate" | "endDate" | "status"> & { borrowerName: string };

/**
 * Owner-only delete. Refuses while a PENDING or APPROVED booking exists (APPROVED also covers
 * picked-up-not-returned, since status only becomes COMPLETED on return). Everything else
 * (shares, bookings, handovers, expenses, documents, timeline, gallery) goes via ON DELETE CASCADE.
 * The FOR UPDATE row lock serializes against concurrent booking inserts (FOR KEY SHARE on the FK).
 */
export async function deleteVehicleAtomic(
  vehicleId: string,
  ownerId: string
): Promise<{ ok: true } | { ok: false; error: string; blocking?: BlockingBooking[] }> {
  const result = await tx(async (sql) => {
    const owned = await sql`SELECT 1 FROM "Vehicle" WHERE id = ${vehicleId} AND "ownerId" = ${ownerId} FOR UPDATE`;
    if (!owned.length) return { ok: false, error: "Car not found." };
    const blocking = await sql`SELECT b.id, b."startDate", b."endDate", b.status, u.name AS "borrowerName"
      FROM "Booking" b JOIN "User" u ON u.id = b."borrowerId"
      WHERE b."vehicleId" = ${vehicleId} AND b.status IN ('PENDING','APPROVED')
      ORDER BY b."startDate" ASC`;
    if (blocking.length) {
      return {
        ok: false,
        error: "This car has pending or approved bookings. Cancel or decline them first.",
        blocking: blocking.map((r) => ({ ...r })),
      };
    }
    await sql`DELETE FROM "Vehicle" WHERE id = ${vehicleId} AND "ownerId" = ${ownerId}`;
    return { ok: true };
  });
  return result as { ok: true } | { ok: false; error: string; blocking?: BlockingBooking[] };
}

/* ---------------- Bookings ---------------- */
export const Bookings = {
  byId: async (bid: string) => get<Booking>('SELECT * FROM "Booking" WHERE id=?', bid),
  forVehicle: async (vid: string) =>
    all<Booking & { borrowerName: string }>(
      `SELECT b.*, u.name AS "borrowerName" FROM "Booking" b JOIN "User" u ON u.id = b."borrowerId"
       WHERE b."vehicleId" = ? ORDER BY b."startDate" DESC`, vid),
  activeForVehicle: async (vid: string) =>
    all<Booking & { borrowerName: string }>(
      `SELECT b.*, u.name AS "borrowerName" FROM "Booking" b JOIN "User" u ON u.id = b."borrowerId"
       WHERE b."vehicleId" = ? AND b.status IN ('PENDING','APPROVED') ORDER BY b."startDate" ASC`, vid),
  byBorrower: async (uid: string) =>
    all<Booking & { make: string; model: string; year: number; imageUrl: string | null; ownerName: string }>(
      `SELECT b.*, v.make, v.model, v.year, v."imageUrl", u.name AS "ownerName"
       FROM "Booking" b JOIN "Vehicle" v ON v.id = b."vehicleId" JOIN "User" u ON u.id = v."ownerId"
       WHERE b."borrowerId" = ? ORDER BY b."startDate" DESC`, uid),
  // Booking requests on vehicles owned by uid
  incomingFor: async (uid: string) =>
    all<Booking & { borrowerName: string; make: string; model: string; year: number }>(
      `SELECT b.*, u.name AS "borrowerName", v.make, v.model, v.year
       FROM "Booking" b JOIN "Vehicle" v ON v.id = b."vehicleId" JOIN "User" u ON u.id = b."borrowerId"
       WHERE v."ownerId" = ? ORDER BY b."createdAt" DESC`, uid),
  overlapping: async (vehicleId: string, startDate: string, endDate: string) =>
    all<Booking>(
      `SELECT * FROM "Booking" WHERE "vehicleId"=? AND status IN ('PENDING','APPROVED')
       AND "startDate"::date <= ?::date AND ?::date <= "endDate"::date`, vehicleId, endDate, startDate),
  async create(d: { vehicleId: string; borrowerId: string; startDate: string; endDate: string; status: string; purpose?: string }) {
    const bid = id();
    await run('INSERT INTO "Booking" (id, "vehicleId", "borrowerId", "startDate", "endDate", status, purpose) VALUES (?,?,?,?,?,?,?)',
      bid, d.vehicleId, d.borrowerId, d.startDate, d.endDate, d.status, d.purpose ?? null);
    return bid;
  },
  setStatus: async (bid: string, status: string) => run('UPDATE "Booking" SET status=? WHERE id=?', status, bid),
};

/**
 * Atomic booking request: overlap check + insert in one transaction.
 * The Vehicle row lock serializes concurrent requests for the same car, so two
 * overlapping requests can't both pass the check at READ COMMITTED.
 * Returns { error } on clash or past start date, or { bid } on success.
 */
export async function requestBookingAtomic(d: {
  vehicleId: string;
  borrowerId: string;
  startDate: string;
  endDate: string;
  status: string;
  purpose?: string;
}): Promise<{ error?: string; bid?: string }> {
  if (d.startDate < earliestToday()) return { error: "Start date can't be in the past." };
  const result = await tx(async (sql) => {
    await sql`SELECT 1 FROM "Vehicle" WHERE id = ${d.vehicleId} FOR UPDATE`;
    const clashes = await sql`SELECT 1 FROM "Booking"
      WHERE "vehicleId" = ${d.vehicleId}
        AND status IN ('PENDING','APPROVED')
        AND "startDate"::date <= ${d.endDate}::date
        AND ${d.startDate}::date <= "endDate"::date
      LIMIT 1`;
    if (clashes.length) return { error: "Those dates overlap an existing booking." };
    const bid = id();
    await sql`INSERT INTO "Booking" (id, "vehicleId", "borrowerId", "startDate", "endDate", status, purpose)
      VALUES (${bid}, ${d.vehicleId}, ${d.borrowerId}, ${d.startDate}, ${d.endDate}, ${d.status}, ${d.purpose ?? null})`;
    return { bid };
  });
  return result as { error?: string; bid?: string };
}

/* ---------------- Handover ---------------- */
export const Handovers = {
  forBooking: async (bid: string) => get<HandoverLog>('SELECT * FROM "HandoverLog" WHERE "bookingId"=?', bid),
  /**
   * Upsert a handover log for a booking. Uses ON CONFLICT to avoid the
   * read-then-write TOCTOU race. Partial updates preserve existing fields
   * via COALESCE(existing, new).
   */
  async upsert(bid: string, d: Partial<HandoverLog>, sql?: Sql) {
    const hid = id();
    const q = sql ?? (await conn());
    await q.unsafe(
      `INSERT INTO "HandoverLog" (id, "bookingId", "pickupMileageKm", "returnMileageKm", "pickupFuelPct", "returnFuelPct",
       "conditionNotes", "damageReported", "checklistJson", "pickedUpAt", "returnedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT ("bookingId") DO UPDATE SET
        "pickupMileageKm" = COALESCE(EXCLUDED."pickupMileageKm", "HandoverLog"."pickupMileageKm"),
        "returnMileageKm" = COALESCE(EXCLUDED."returnMileageKm", "HandoverLog"."returnMileageKm"),
        "pickupFuelPct" = COALESCE(EXCLUDED."pickupFuelPct", "HandoverLog"."pickupFuelPct"),
        "returnFuelPct" = COALESCE(EXCLUDED."returnFuelPct", "HandoverLog"."returnFuelPct"),
        "conditionNotes" = COALESCE(EXCLUDED."conditionNotes", "HandoverLog"."conditionNotes"),
        "damageReported" = GREATEST(EXCLUDED."damageReported", "HandoverLog"."damageReported"), -- a reported damage flag is never cleared
        "checklistJson" = COALESCE(EXCLUDED."checklistJson", "HandoverLog"."checklistJson"),
        "pickedUpAt" = COALESCE(EXCLUDED."pickedUpAt", "HandoverLog"."pickedUpAt"),
        "returnedAt" = COALESCE(EXCLUDED."returnedAt", "HandoverLog"."returnedAt"),
        "updatedAt" = now()`,
      [hid, bid, d.pickupMileageKm ?? null, d.returnMileageKm ?? null, d.pickupFuelPct ?? null, d.returnFuelPct ?? null,
      d.conditionNotes ?? null, d.damageReported ?? 0, d.checklistJson ?? null, d.pickedUpAt ?? null, d.returnedAt ?? null]
    );
  },
};

type GuardResult = { ok: true } | { ok: false; error: string };

/** Lock a booking and return it with owner and pickup facts, or undefined if the user isn't owner or borrower. */
async function lockBookingFor(sql: Sql, bookingId: string, userId: string) {
  const [row] = await sql<{ status: string; isOwner: boolean; pickedUp: boolean }[]>`
    SELECT b.status, v."ownerId" = ${userId} AS "isOwner",
      EXISTS (SELECT 1 FROM "HandoverLog" h WHERE h."bookingId" = b.id AND h."pickedUpAt" IS NOT NULL) AS "pickedUp"
    FROM "Booking" b JOIN "Vehicle" v ON v.id = b."vehicleId"
    WHERE b.id = ${bookingId} AND (v."ownerId" = ${userId} OR b."borrowerId" = ${userId})
    FOR UPDATE OF b`;
  return row;
}

/** Owner or borrower cancel. Refused once finished or once the car is picked up (owner completes instead). */
export async function cancelBookingAtomic(bookingId: string, userId: string): Promise<GuardResult> {
  return tx(async (sql): Promise<GuardResult> => {
    const b = await lockBookingFor(sql, bookingId, userId);
    if (!b) return { ok: false, error: "Booking not found." };
    if (b.status === "COMPLETED" || b.status === "CANCELLED") return { ok: false, error: "This booking is already closed." };
    if (b.pickedUp) return { ok: false, error: "The car has been picked up. Complete the booking instead." };
    await sql`UPDATE "Booking" SET status = 'CANCELLED' WHERE id = ${bookingId}`;
    return { ok: true };
  });
}

/** Pickup only when APPROVED; return only when APPROVED and picked up, which completes the booking. */
export async function saveHandoverAtomic(
  bookingId: string,
  userId: string,
  phase: "pickup" | "return",
  data: Partial<HandoverLog>,
): Promise<GuardResult> {
  return tx(async (sql): Promise<GuardResult> => {
    const b = await lockBookingFor(sql, bookingId, userId);
    if (!b) return { ok: false, error: "Booking not found." };
    if (b.status !== "APPROVED") return { ok: false, error: "Handover is only possible for an approved booking." };
    if (phase === "return" && !b.pickedUp) return { ok: false, error: "Log the pickup before the return." };
    await Handovers.upsert(bookingId, data, sql);
    if (phase === "return") await sql`UPDATE "Booking" SET status = 'COMPLETED' WHERE id = ${bookingId}`;
    return { ok: true };
  });
}

/* ---------------- Aggregates ---------------- */
export async function categoryTotals(vehicleId: string) {
  return all<{ category: string; total: number }>(
    'SELECT category, SUM(amount) total FROM "Expense" WHERE "vehicleId"=? GROUP BY category ORDER BY total DESC', vehicleId);
}
/** Bulk fetch category totals for many vehicles in one query (avoids N+1). */
export async function categoryTotalsForVehicles(vids: string[]): Promise<Record<string, { category: string; total: number }[]>> {
  if (!vids.length) return {};
  const placeholders = vids.map((_, i) => `$${i + 1}`).join(",");
  const rows = await all<{ vehicleId: string; category: string; total: number }>(
    `SELECT "vehicleId", category, SUM(amount) total FROM "Expense" WHERE "vehicleId" IN (${placeholders}) GROUP BY "vehicleId", category ORDER BY total DESC`,
    ...vids,
  );
  const map: Record<string, { category: string; total: number }[]> = {};
  for (const r of rows) {
    (map[r.vehicleId] ??= []).push({ category: r.category, total: r.total });
  }
  return map;
}
export async function categoryTotalsForOwner(uid: string) {
  return all<{ category: string; total: number }>(
    `SELECT e.category, SUM(e.amount) total FROM "Expense" e JOIN "Vehicle" v ON v.id = e."vehicleId"
     WHERE v."ownerId" = ? GROUP BY e.category ORDER BY total DESC`, uid);
}
export async function vehicleCostTotals(uid: string) {
  return all<{ vehicleId: string; total: number }>(
    `SELECT e."vehicleId", SUM(e.amount) total FROM "Expense" e JOIN "Vehicle" v ON v.id = e."vehicleId"
     WHERE v."ownerId" = ? GROUP BY e."vehicleId"`, uid);
}