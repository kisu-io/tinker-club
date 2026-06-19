"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { Vehicles, Expenses, Documents, Timeline, Gallery } from "@/lib/repo";

async function ownGuard(vehicleId: string) {
  const user = await requireUser();
  const v = await Vehicles.forOwner(vehicleId, user.id);
  if (!v) throw new Error("Not found");
  return { user, v };
}

/* Expenses */
export async function addExpense(vehicleId: string, fd: FormData) {
  await ownGuard(vehicleId);
  const amount = parseFloat(String(fd.get("amount") || "0"));
  if (!fd.get("name") || !Number.isFinite(amount)) return;
  await Expenses.create({
    vehicleId,
    name: String(fd.get("name")),
    category: String(fd.get("category") || "OTHER"),
    type: String(fd.get("type") || "QUICK COST"),
    amount,
    date: String(fd.get("date") || new Date().toISOString().slice(0, 10)),
    notes: String(fd.get("notes") || "") || undefined,
  });
  revalidatePath(`/dashboard/collection/${vehicleId}/expenses`);
  revalidatePath(`/dashboard/expense-manager`);
}
export async function deleteExpense(vehicleId: string, expenseId: string) {
  await ownGuard(vehicleId);
  await Expenses.remove(expenseId, vehicleId);
  revalidatePath(`/dashboard/collection/${vehicleId}/expenses`);
  revalidatePath(`/dashboard/expense-manager`);
}

/* Documents */
export async function addDocument(vehicleId: string, fd: FormData) {
  const { user } = await ownGuard(vehicleId);
  if (!fd.get("name")) return;
  await Documents.create({
    vehicleId,
    name: String(fd.get("name")),
    category: String(fd.get("category") || "OTHER"),
    type: String(fd.get("type") || "PDF"),
    fileUrl: String(fd.get("fileUrl") || "") || undefined,
    uploadedById: user.id,
  });
  revalidatePath(`/dashboard/collection/${vehicleId}/documents`);
}
export async function deleteDocument(vehicleId: string, documentId: string) {
  await ownGuard(vehicleId);
  await Documents.remove(documentId, vehicleId);
  revalidatePath(`/dashboard/collection/${vehicleId}/documents`);
}

/* Timeline */
export async function addTimelineEvent(vehicleId: string, fd: FormData) {
  await ownGuard(vehicleId);
  const year = parseInt(String(fd.get("year") || ""), 10);
  if (!fd.get("title") || !Number.isFinite(year)) return;
  await Timeline.create({
    vehicleId,
    year,
    title: String(fd.get("title")),
    description: String(fd.get("description") || "") || undefined,
    imageUrl: String(fd.get("imageUrl") || "") || undefined,
    category: String(fd.get("category") || "HISTORY"),
    eventDate: String(fd.get("eventDate") || "") || undefined,
  });
  revalidatePath(`/dashboard/collection/${vehicleId}/timeline`);
  revalidatePath(`/dashboard/collection/${vehicleId}/profile`);
}
export async function deleteTimelineEvent(vehicleId: string, eventId: string) {
  await ownGuard(vehicleId);
  await Timeline.remove(eventId, vehicleId);
  revalidatePath(`/dashboard/collection/${vehicleId}/timeline`);
}

/* Gallery */
export async function addGalleryImage(vehicleId: string, fd: FormData) {
  await ownGuard(vehicleId);
  const url = String(fd.get("url") || "");
  if (!url) return;
  await Gallery.create({ vehicleId, url, caption: String(fd.get("caption") || "") || undefined });
  revalidatePath(`/dashboard/collection/${vehicleId}/gallery`);
}
export async function deleteGalleryImage(vehicleId: string, imageId: string) {
  await ownGuard(vehicleId);
  await Gallery.remove(imageId, vehicleId);
  revalidatePath(`/dashboard/collection/${vehicleId}/gallery`);
}
