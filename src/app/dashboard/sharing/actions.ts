"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  Clubs, Memberships, Shares, Vehicles, Bookings, Handovers,
} from "@/lib/repo";

/* ---------------- Clubs ---------------- */
export async function createClub(fd: FormData) {
  const user = await requireUser();
  const name = String(fd.get("name") || "").trim();
  if (!name) return;
  const club = Clubs.create(user.id, name, { description: String(fd.get("description") || "") || undefined });
  revalidatePath("/dashboard/sharing");
  redirect(`/dashboard/sharing/${club.id}`);
}

export async function joinClub(fd: FormData) {
  const user = await requireUser();
  const code = String(fd.get("code") || "").trim().toUpperCase();
  const club = Clubs.byInvite(code);
  if (!club) return { error: "No club found for that invite code." };
  Memberships.add(club.id, user.id, "MEMBER");
  revalidatePath("/dashboard/sharing");
  redirect(`/dashboard/sharing/${club.id}`);
}

export async function leaveClub(clubId: string) {
  const user = await requireUser();
  const club = Clubs.byId(clubId);
  if (!club || club.ownerId === user.id) return; // owner can't leave
  Memberships.remove(clubId, user.id);
  revalidatePath("/dashboard/sharing");
  redirect("/dashboard/sharing");
}

/* ---------------- Sharing a vehicle into a club ---------------- */
export async function shareVehicle(fd: FormData) {
  const user = await requireUser();
  const vehicleId = String(fd.get("vehicleId"));
  const clubId = String(fd.get("clubId"));
  const requireApproval = fd.get("requireApproval") != null;

  const vehicle = Vehicles.forOwner(vehicleId, user.id);
  const membership = Memberships.of(clubId, user.id);
  if (!vehicle || !membership) return;

  Shares.add(vehicleId, clubId, requireApproval);
  // Reflect shared state on the vehicle visibility badge.
  if (vehicle.visibility === "PRIVATE") Vehicles.setVisibility(vehicleId, "CLUB");
  revalidatePath(`/dashboard/collection/${vehicleId}/share`);
  revalidatePath(`/dashboard/sharing/${clubId}`);
}

export async function unshareVehicle(vehicleId: string, clubId: string) {
  const user = await requireUser();
  const vehicle = Vehicles.forOwner(vehicleId, user.id);
  if (!vehicle) return;
  Shares.remove(vehicleId, clubId);
  if (Vehicles.shareCount(vehicleId) === 0 && vehicle.visibility === "CLUB") {
    Vehicles.setVisibility(vehicleId, "PRIVATE");
  }
  revalidatePath(`/dashboard/collection/${vehicleId}/share`);
  revalidatePath(`/dashboard/sharing/${clubId}`);
}

/* ---------------- Bookings ---------------- */
export async function requestBooking(fd: FormData) {
  const user = await requireUser();
  const vehicleId = String(fd.get("vehicleId"));
  const startDate = String(fd.get("startDate"));
  const endDate = String(fd.get("endDate"));
  if (!startDate || !endDate) return { error: "Pick both dates." };
  if (new Date(endDate) < new Date(startDate)) return { error: "End date must be after start date." };

  const vehicle = Vehicles.byId(vehicleId);
  if (!vehicle || vehicle.ownerId === user.id) return { error: "You can't book your own car." };

  const access = Shares.isBookableBy(vehicleId, user.id);
  if (!access) return { error: "This car isn't shared with any of your clubs." };

  const clashes = Bookings.overlapping(vehicleId, startDate, endDate);
  if (clashes.length) return { error: "Those dates overlap an existing booking." };

  const status = access.requireApproval ? "PENDING" : "APPROVED";
  Bookings.create({
    vehicleId,
    borrowerId: user.id,
    startDate,
    endDate,
    status,
    purpose: String(fd.get("purpose") || "") || undefined,
  });
  revalidatePath("/dashboard/sharing");
  revalidatePath(`/dashboard/collection/${vehicleId}/share`);
  return { ok: true, status };
}

export async function decideBooking(bookingId: string, decision: "APPROVED" | "DECLINED") {
  const user = await requireUser();
  const booking = Bookings.byId(bookingId);
  if (!booking) return;
  const vehicle = Vehicles.forOwner(booking.vehicleId, user.id); // only owner decides
  if (!vehicle) return;
  Bookings.setStatus(bookingId, decision);
  revalidatePath("/dashboard/sharing");
  revalidatePath(`/dashboard/collection/${booking.vehicleId}/share`);
}

export async function cancelBooking(bookingId: string) {
  const user = await requireUser();
  const booking = Bookings.byId(bookingId);
  if (!booking) return;
  const isBorrower = booking.borrowerId === user.id;
  const isOwner = !!Vehicles.forOwner(booking.vehicleId, user.id);
  if (!isBorrower && !isOwner) return;
  Bookings.setStatus(bookingId, "CANCELLED");
  revalidatePath("/dashboard/sharing");
  revalidatePath(`/dashboard/collection/${booking.vehicleId}/share`);
}

export async function completeBooking(bookingId: string) {
  const user = await requireUser();
  const booking = Bookings.byId(bookingId);
  if (!booking) return;
  const isOwner = !!Vehicles.forOwner(booking.vehicleId, user.id);
  if (!isOwner && booking.borrowerId !== user.id) return;
  Bookings.setStatus(bookingId, "COMPLETED");
  revalidatePath("/dashboard/sharing");
}

/* ---------------- Handover log ---------------- */
function intOrNull(fd: FormData, k: string): number | null {
  const v = parseInt(String(fd.get(k) || ""), 10);
  return Number.isFinite(v) ? v : null;
}

export async function saveHandover(bookingId: string, phase: "pickup" | "return", fd: FormData) {
  const user = await requireUser();
  const booking = Bookings.byId(bookingId);
  if (!booking) return;
  const isOwner = !!Vehicles.forOwner(booking.vehicleId, user.id);
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
  Handovers.upsert(bookingId, data as any);

  // Returning the car completes the booking.
  if (phase === "return") Bookings.setStatus(bookingId, "COMPLETED");
  revalidatePath("/dashboard/sharing");
  revalidatePath(`/dashboard/sharing/booking/${bookingId}`);
}
