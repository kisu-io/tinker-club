"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  Clubs, Memberships, Vehicles, Bookings, Handovers, Shares,
  shareVehicleAtomic, unshareVehicleAtomic, requestBookingAtomic,
} from "@/lib/repo";
import type { BookingStatus } from "@/lib/types";

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
  await Memberships.remove(clubId, user.id);
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
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function requestBooking(fd: FormData) {
  const user = await requireUser();
  const vehicleId = String(fd.get("vehicleId"));
  const startDate = String(fd.get("startDate"));
  const endDate = String(fd.get("endDate"));
  if (!startDate || !endDate) return { error: "Pick both dates." };
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) return { error: "Dates must be YYYY-MM-DD." };
  if (new Date(endDate) < new Date(startDate)) return { error: "End date must be after start date." };

  const vehicle = await Vehicles.byId(vehicleId);
  if (!vehicle || vehicle.ownerId === user.id) return { error: "You can't book your own car." };

  const access = await Shares.isBookableBy(vehicleId, user.id);
  if (!access) return { error: "This car isn't shared with any of your clubs." };

  const status = access.requireApproval ? "PENDING" : "APPROVED";
  const purpose = String(fd.get("purpose") || "").trim() || undefined;
  const result = await requestBookingAtomic({
    vehicleId,
    borrowerId: user.id,
    startDate,
    endDate,
    status,
    purpose,
  });
  if (result.error) return { error: result.error };
  revalidatePath("/dashboard/sharing");
  revalidatePath(`/dashboard/collection/${vehicleId}/share`);
  return { ok: true, status };
}

export async function decideBooking(bookingId: string, decision: "APPROVED" | "DECLINED") {
  const user = await requireUser();
  const booking = await Bookings.byId(bookingId);
  if (!booking) return;
  const vehicle = await Vehicles.forOwner(booking.vehicleId, user.id); // only owner decides
  if (!vehicle) return;
  // State machine: only PENDING bookings can be approved/declined.
  if (booking.status !== "PENDING") return;
  await Bookings.setStatus(bookingId, decision);
  revalidatePath("/dashboard/sharing");
  revalidatePath(`/dashboard/collection/${booking.vehicleId}/share`);
}

export async function cancelBooking(bookingId: string) {
  const user = await requireUser();
  const booking = await Bookings.byId(bookingId);
  if (!booking) return;
  // State machine: can't cancel a completed or already-cancelled booking.
  if (booking.status === "COMPLETED" || booking.status === "CANCELLED") return;
  const isBorrower = booking.borrowerId === user.id;
  const isOwner = !!(await Vehicles.forOwner(booking.vehicleId, user.id));
  if (!isBorrower && !isOwner) return;
  await Bookings.setStatus(bookingId, "CANCELLED");
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
  await Bookings.setStatus(bookingId, "COMPLETED");
  revalidatePath("/dashboard/sharing");
}

/* ---------------- Handover log ---------------- */
function intOrNull(fd: FormData, k: string): number | null {
  const v = parseInt(String(fd.get(k) || ""), 10);
  return Number.isFinite(v) ? v : null;
}

export async function saveHandover(bookingId: string, phase: "pickup" | "return", fd: FormData) {
  const user = await requireUser();
  const booking = await Bookings.byId(bookingId);
  if (!booking) return;
  const isOwner = !!(await Vehicles.forOwner(booking.vehicleId, user.id));
  if (!isOwner && booking.borrowerId !== user.id) return;

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
  await Handovers.upsert(bookingId, data);

  // Returning the car completes the booking (only if APPROVED).
  if (phase === "return" && booking.status === "APPROVED") {
    await Bookings.setStatus(bookingId, "COMPLETED");
  }
  revalidatePath("/dashboard/sharing");
  revalidatePath(`/dashboard/sharing/booking/${bookingId}`);
}