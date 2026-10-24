"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  Clubs, Memberships, Vehicles, Bookings, Shares,
  shareVehicleAtomic, unshareVehicleAtomic, requestBookingAtomic,
  leaveClubAtomic, cancelBookingAtomic, saveHandoverAtomic, addBlockAtomic, Blocks,
} from "@/lib/repo";
import { isHalf, isValidRange, type SlotRange } from "@/lib/slots";
import { isDay } from "@/lib/calendar";

// Branding inputs are user-supplied; validate before storing so they can't be
// abused (CSS-property injection via color, tracking/non-https logo URLs).
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
function httpsUrlOrNull(raw: string): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).protocol === "https:" ? raw : null;
  } catch {
    return null;
  }
}

/* ---------------- Clubs ---------------- */
export async function createClub(fd: FormData) {
  const user = await requireUser();
  const name = String(fd.get("name") || "").trim();
  if (!name) return { error: "Name is required." };

  const rawPrimary = String(fd.get("primaryColor") || "").trim();
  const rawAccent = String(fd.get("accentColor") || "").trim();
  const rawLogo = String(fd.get("logoUrl") || "").trim();
  if (rawLogo && !httpsUrlOrNull(rawLogo)) return { error: "Logo URL must be an https:// link." };

  // Clubs.create enforces slug uniqueness; just pass the raw desired slug (or undefined).
  const club = await Clubs.create(user.id, name, {
    description: String(fd.get("description") || "") || undefined,
    slug: String(fd.get("slug") || "").trim() || undefined,
    primaryColor: HEX_COLOR.test(rawPrimary) ? rawPrimary : undefined,
    accentColor: HEX_COLOR.test(rawAccent) ? rawAccent : undefined,
    logoUrl: httpsUrlOrNull(rawLogo) ?? undefined,
    tagline: String(fd.get("tagline") || "") || undefined,
  });
  revalidatePath("/dashboard/sharing");
  redirect(`/g/${club.slug}`);
}

export async function joinClub(fd: FormData) {
  const user = await requireUser();
  const code = String(fd.get("code") || "").trim().toUpperCase();
  const club = await Clubs.byInvite(code);
  if (!club) return { error: "No group found for that invite code." };
  await Memberships.add(club.id, user.id, "MEMBER");
  revalidatePath("/dashboard/sharing");
  redirect(`/g/${club.slug}`);
}

export async function leaveClub(clubId: string) {
  const user = await requireUser();
  const club = await Clubs.byId(clubId);
  if (!club || club.ownerId === user.id) return; // owner can't leave
  await leaveClubAtomic(clubId, user.id);
  revalidatePath("/dashboard/sharing");
  redirect("/dashboard/sharing");
}

/* ---------------- Sharing a vehicle into a club ---------------- */
export async function shareVehicle(fd: FormData) {
  const user = await requireUser();
  const vehicleId = String(fd.get("vehicleId"));
  const clubId = String(fd.get("clubId"));
  const requireApproval = fd.get("requireApproval") != null;

  const vehicle = await Vehicles.forOwner(vehicleId, user.id);
  const membership = await Memberships.of(clubId, user.id);
  if (!vehicle || !membership) return;

  await shareVehicleAtomic(vehicleId, clubId, requireApproval);
  revalidatePath(`/dashboard/collection/${vehicleId}/share`);
  revalidatePath(`/dashboard/sharing/${clubId}`);
}

export async function unshareVehicle(vehicleId: string, clubId: string) {
  const user = await requireUser();
  const vehicle = await Vehicles.forOwner(vehicleId, user.id);
  if (!vehicle) return;
  await unshareVehicleAtomic(vehicleId, clubId);
  revalidatePath(`/dashboard/collection/${vehicleId}/share`);
  revalidatePath(`/dashboard/sharing/${clubId}`);
}

/* ---------------- Bookings ---------------- */
/** Parse startDate/startHalf/endDate/endHalf form fields (halves default to a whole-day AM -> PM range). */
function parseRange(fd: FormData): { range: SlotRange } | { error: string } {
  const startDate = String(fd.get("startDate") || "");
  const endDate = String(fd.get("endDate") || "");
  const startHalf = fd.get("startHalf") ?? "AM";
  const endHalf = fd.get("endHalf") ?? "PM";
  if (!startDate || !endDate) return { error: "Pick both dates." };
  if (!isDay(startDate) || !isDay(endDate))
    return { error: "Dates must be YYYY-MM-DD." };
  if (!isHalf(startHalf) || !isHalf(endHalf)) return { error: "Pick morning or afternoon." };
  const range = { startDate, startHalf, endDate, endHalf };
  if (!isValidRange(range)) return { error: "The end must be after the start." };
  return { range };
}

export async function requestBooking(fd: FormData) {
  const user = await requireUser();
  const vehicleId = String(fd.get("vehicleId"));
  const parsed = parseRange(fd);
  if ("error" in parsed) return { error: parsed.error };

  const vehicle = await Vehicles.byId(vehicleId);
  if (!vehicle || vehicle.ownerId === user.id) return { error: "You can't book your own car." };

  const access = await Shares.isBookableBy(vehicleId, user.id);
  if (!access) return { error: "This car isn't shared with any of your clubs." };

  const purpose = String(fd.get("purpose") || "").trim() || undefined;
  const result = await requestBookingAtomic({
    vehicleId,
    borrowerId: user.id,
    ...parsed.range,
    purpose,
  });
  if (result.error) return { error: result.error, nextFree: result.nextFree };
  revalidatePath("/dashboard/sharing");
  revalidatePath(`/dashboard/collection/${vehicleId}/share`);
  return { ok: true, status: result.status };
}

export async function decideBooking(bookingId: string, decision: "APPROVED" | "DECLINED") {
  const user = await requireUser();
  const booking = await Bookings.byId(bookingId);
  if (!booking) return;
  const vehicle = await Vehicles.forOwner(booking.vehicleId, user.id); // only owner decides
  if (!vehicle) return;
  // State machine: only PENDING, not yet expired, bookings can be approved/declined.
  if (!(await Bookings.decide(bookingId, decision))) return { error: "This request is no longer pending." };
  revalidatePath("/dashboard/sharing");
  revalidatePath(`/dashboard/collection/${booking.vehicleId}/share`);
}

export async function cancelBooking(bookingId: string) {
  const user = await requireUser();
  const booking = await Bookings.byId(bookingId);
  if (!booking) return;
  // State machine (closed, picked up) and owner/borrower checks live in cancelBookingAtomic.
  const result = await cancelBookingAtomic(bookingId, user.id);
  if (!result.ok) return result;
  revalidatePath("/dashboard/sharing");
  revalidatePath(`/dashboard/collection/${booking.vehicleId}/share`);
}

export async function completeBooking(bookingId: string) {
  const user = await requireUser();
  const booking = await Bookings.byId(bookingId);
  if (!booking) return;
  // State machine: only APPROVED bookings can be completed.
  if (booking.status !== "APPROVED") return;
  const isOwner = !!(await Vehicles.forOwner(booking.vehicleId, user.id));
  if (!isOwner && booking.borrowerId !== user.id) return;
  await Bookings.transition(bookingId, "APPROVED", "COMPLETED");
  revalidatePath("/dashboard/sharing");
}

/* ---------------- Handover log ---------------- */
function intOrNull(fd: FormData, k: string): number | null {
  const v = parseInt(String(fd.get(k) || ""), 10);
  return Number.isFinite(v) ? v : null;
}

export async function saveHandover(bookingId: string, phase: "pickup" | "return", fd: FormData) {
  const user = await requireUser();
  const checklist = fd.getAll("checklist").map((c) => String(c));
  const data =
    phase === "pickup"
      ? {
          pickupMileageKm: intOrNull(fd, "mileageKm"),
          pickupFuelPct: intOrNull(fd, "fuelPct"),
          checklistJson: JSON.stringify(checklist),
          conditionNotes: String(fd.get("notes") || "") || undefined,
          pickedUpAt: new Date().toISOString(),
        }
      : {
          returnMileageKm: intOrNull(fd, "mileageKm"),
          returnFuelPct: intOrNull(fd, "fuelPct"),
          damageReported: fd.get("damage") != null ? 1 : 0,
          conditionNotes: String(fd.get("notes") || "") || undefined,
          returnedAt: new Date().toISOString(),
        };
  // Owner/borrower and status guards live in saveHandoverAtomic; a return completes the booking.
  const result = await saveHandoverAtomic(bookingId, user.id, phase, data);
  if (!result.ok) return result;
  revalidatePath("/dashboard/sharing");
  revalidatePath(`/dashboard/sharing/booking/${bookingId}`);
}

/* ---------------- Owner blocks ---------------- */
export async function addBlock(fd: FormData) {
  const user = await requireUser();
  const vehicleId = String(fd.get("vehicleId"));
  const parsed = parseRange(fd);
  if ("error" in parsed) return { error: parsed.error };
  const reason = String(fd.get("reason") || "").trim().slice(0, 120) || undefined;
  // Ownership, overlap with bookings/blocks and past dates are checked under the Vehicle lock.
  const result = await addBlockAtomic({ vehicleId, ownerId: user.id, ...parsed.range, reason });
  if (!result.ok) return { error: result.error, bookingId: result.bookingId };
  revalidatePath(`/dashboard/collection/${vehicleId}/share`);
  return { ok: true };
}

export async function removeBlock(blockId: string) {
  const user = await requireUser();
  const vehicleId = await Blocks.remove(blockId, user.id);
  if (vehicleId) revalidatePath(`/dashboard/collection/${vehicleId}/share`);
}
