"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { Vehicles, Timeline } from "@/lib/repo";
import type { Visibility } from "@/lib/types";

function num(fd: FormData, key: string): number | null {
  const v = parseInt(String(fd.get(key) || ""), 10);
  return Number.isFinite(v) ? v : null;
}

export async function createVehicle(formData: FormData) {
  const user = await requireUser();
  const make = String(formData.get("make") || "").trim();
  const model = String(formData.get("model") || "").trim();
  const year = num(formData, "year");
  if (!make || !model || year == null) return;

  const vehicle = Vehicles.create({
    ownerId: user.id,
    make,
    model,
    year,
    imageUrl: String(formData.get("imageUrl") || "") || null,
    mileageKm: num(formData, "mileageKm") ?? 0,
    cylinders: num(formData, "cylinders"),
    performanceKw: num(formData, "performanceKw"),
    color: String(formData.get("color") || "") || null,
  });

  // Seed the timeline with the "beginning" event, like the original.
  Timeline.create({
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
  const v = Vehicles.forOwner(vehicleId, user.id);
  if (!v) return;
  Vehicles.updateSpecs(vehicleId, {
    model: String(formData.get("model") || v.model),
    cylinders: num(formData, "cylinders"),
    performanceKw: num(formData, "performanceKw"),
    mileageKm: num(formData, "mileageKm") ?? v.mileageKm,
    color: String(formData.get("color") || "") || null,
    vin: String(formData.get("vin") || "") || null,
    description: String(formData.get("description") || "") || null,
    imageUrl: String(formData.get("imageUrl") || "") || v.imageUrl,
  });
  revalidatePath(`/dashboard/collection/${vehicleId}/profile`);
}

export async function updateTechnical(vehicleId: string, formData: FormData) {
  const user = await requireUser();
  const v = Vehicles.forOwner(vehicleId, user.id);
  if (!v) return;
  Vehicles.updateTechnical(vehicleId, {
    vehicleType: String(formData.get("vehicleType") || "") || null,
    bodyStyle: String(formData.get("bodyStyle") || "") || null,
    previousOwners: num(formData, "previousOwners"),
    unitsProduced: num(formData, "unitsProduced"),
    transmissionNumber: String(formData.get("transmissionNumber") || "") || null,
    location: String(formData.get("location") || "") || null,
    gearbox: String(formData.get("gearbox") || "") || null,
    driveType: String(formData.get("driveType") || "") || null,
    driversSide: String(formData.get("driversSide") || "") || null,
    matchingNumbers: formData.get("matchingNumbers") != null ? 1 : 0,
    vin: String(formData.get("vin") || "") || null,
  });
  revalidatePath(`/dashboard/collection/${vehicleId}/profile`);
}

export async function updateFacts(vehicleId: string, formData: FormData) {
  const user = await requireUser();
  const v = Vehicles.forOwner(vehicleId, user.id);
  if (!v) return;
  const facts = String(formData.get("keyFacts") || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  Vehicles.updateFacts(
    vehicleId,
    facts.length ? JSON.stringify(facts) : null,
    String(formData.get("overview") || "") || null
  );
  revalidatePath(`/dashboard/collection/${vehicleId}/profile`);
}

export async function setVisibility(vehicleId: string, visibility: Visibility) {
  const user = await requireUser();
  const v = Vehicles.forOwner(vehicleId, user.id);
  if (!v) return;
  Vehicles.setVisibility(vehicleId, visibility);
  revalidatePath(`/dashboard/collection/${vehicleId}/profile`);
}

export async function deleteVehicle(vehicleId: string) {
  const user = await requireUser();
  Vehicles.remove(vehicleId, user.id);
  revalidatePath("/dashboard/collection");
  redirect("/dashboard/collection");
}
