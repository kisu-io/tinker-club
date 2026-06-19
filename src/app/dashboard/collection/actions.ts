"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { Vehicles, Timeline } from "@/lib/repo";
import type { Visibility } from "@/lib/types";
import { EXPENSE_CATEGORIES } from "@/lib/constants";

function num(fd: FormData, key: string): number | null {
  const v = parseInt(String(fd.get(key) || ""), 10);
  return Number.isFinite(v) ? v : null;
}

function httpsUrlOrNull(raw: string): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).protocol === "https:" ? raw : null;
  } catch {
    return null;
  }
}

const VALID_VISIBILITIES = new Set(["PRIVATE", "CLUB", "PUBLIC"]);
const CURRENT_YEAR = new Date().getFullYear();

export async function createVehicle(formData: FormData) {
  const user = await requireUser();
  const make = String(formData.get("make") || "").trim();
  const model = String(formData.get("model") || "").trim();
  const year = num(formData, "year");
  if (!make || !model || year == null) return;
  if (year < 1886 || year > CURRENT_YEAR + 1) return; // first car was 1886

  const imageUrl = httpsUrlOrNull(String(formData.get("imageUrl") || "").trim());
  const mileageKm = num(formData, "mileageKm");
  if (mileageKm != null && (mileageKm < 0 || mileageKm > 10_000_000)) return;
  const cylinders = num(formData, "cylinders");
  if (cylinders != null && (cylinders < 1 || cylinders > 32)) return;
  const performanceKw = num(formData, "performanceKw");
  if (performanceKw != null && (performanceKw < 1 || performanceKw > 10_000)) return;

  const vehicle = await Vehicles.create({
    ownerId: user.id,
    make,
    model,
    year,
    imageUrl,
    mileageKm: mileageKm ?? 0,
    cylinders,
    performanceKw,
    color: String(formData.get("color") || "").trim() || null,
  });

  // Seed the timeline with the "beginning" event, like the original.
  await Timeline.create({
    vehicleId: vehicle.id,
    year,
    title: "The beginning",
    description: "This is the year the car was created.",
  });

  revalidatePath("/dashboard/collection");
  redirect(`/dashboard/collection/${vehicle.id}/profile`);
}

export async function updateVehicleSpecs(vehicleId: string, formData: FormData) {
  const user = await requireUser();
  const v = await Vehicles.forOwner(vehicleId, user.id);
  if (!v) return;
  const imageUrl = String(formData.get("imageUrl") || "").trim();
  await Vehicles.updateSpecs(vehicleId, {
    model: String(formData.get("model") || v.model).trim(),
    cylinders: num(formData, "cylinders"),
    performanceKw: num(formData, "performanceKw"),
    mileageKm: num(formData, "mileageKm") ?? v.mileageKm,
    color: String(formData.get("color") || "").trim() || null,
    vin: String(formData.get("vin") || "").trim() || null,
    description: String(formData.get("description") || "").trim() || null,
    imageUrl: imageUrl ? httpsUrlOrNull(imageUrl) : v.imageUrl,
  });
  revalidatePath(`/dashboard/collection/${vehicleId}/profile`);
}

export async function updateTechnical(vehicleId: string, formData: FormData) {
  const user = await requireUser();
  const v = await Vehicles.forOwner(vehicleId, user.id);
  if (!v) return;
  await Vehicles.updateTechnical(vehicleId, {
    vehicleType: String(formData.get("vehicleType") || "").trim() || null,
    bodyStyle: String(formData.get("bodyStyle") || "").trim() || null,
    previousOwners: num(formData, "previousOwners"),
    unitsProduced: num(formData, "unitsProduced"),
    transmissionNumber: String(formData.get("transmissionNumber") || "").trim() || null,
    location: String(formData.get("location") || "").trim() || null,
    gearbox: String(formData.get("gearbox") || "").trim() || null,
    driveType: String(formData.get("driveType") || "").trim() || null,
    driversSide: String(formData.get("driversSide") || "").trim() || null,
    matchingNumbers: formData.get("matchingNumbers") != null ? 1 : 0,
    vin: String(formData.get("vin") || "").trim() || null,
  });
  revalidatePath(`/dashboard/collection/${vehicleId}/profile`);
}

export async function updateFacts(vehicleId: string, formData: FormData) {
  const user = await requireUser();
  const v = await Vehicles.forOwner(vehicleId, user.id);
  if (!v) return;
  const facts = String(formData.get("keyFacts") || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  await Vehicles.updateFacts(
    vehicleId,
    facts.length ? JSON.stringify(facts) : null,
    String(formData.get("overview") || "").trim() || null
  );
  revalidatePath(`/dashboard/collection/${vehicleId}/profile`);
}

export async function setVisibility(vehicleId: string, visibility: Visibility) {
  const user = await requireUser();
  if (!VALID_VISIBILITIES.has(visibility)) return;
  const v = await Vehicles.forOwner(vehicleId, user.id);
  if (!v) return;
  await Vehicles.setVisibility(vehicleId, visibility);
  revalidatePath(`/dashboard/collection/${vehicleId}/profile`);
}

export async function deleteVehicle(vehicleId: string) {
  const user = await requireUser();
  await Vehicles.remove(vehicleId, user.id);
  revalidatePath("/dashboard/collection");
  redirect("/dashboard/collection");
}