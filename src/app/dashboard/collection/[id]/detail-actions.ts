"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { Vehicles, Expenses, Documents, Timeline, Gallery } from "@/lib/repo";
import { EXPENSE_CATEGORIES, DOCUMENT_CATEGORIES } from "@/lib/constants";
import type { TimelineCategory } from "@/lib/types";

async function ownGuard(vehicleId: string) {
  const user = await requireUser();
  const v = await Vehicles.forOwner(vehicleId, user.id);
  if (!v) throw new Error("Not found");
  return { user, v };
}

const VALID_TIMELINE_CATEGORIES = new Set(["SERVICE", "RESTORATION", "ADMIN", "HISTORY"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENT_YEAR = new Date().getFullYear();

/* Expenses */
export async function addExpense(vehicleId: string, fd: FormData) {
  await ownGuard(vehicleId);
  const amount = parseFloat(String(fd.get("amount") || "0"));
  const name = String(fd.get("name") || "").trim();
  if (!name || !Number.isFinite(amount)) return;
  if (amount < 0 || amount > 1_000_000) return; // clamp to sane range
  const category = String(fd.get("category") || "OTHER").trim();
  if (!EXPENSE_CATEGORIES.includes(category as typeof EXPENSE_CATEGORIES[number])) return;
  const date = String(fd.get("date") || new Date().toISOString().slice(0, 10));
  if (!DATE_RE.test(date)) return;
  await Expenses.create({
    vehicleId,
    name,
    category,
    type: String(fd.get("type") || "QUICK COST").trim() || "QUICK COST",
    amount,
    date,
    notes: String(fd.get("notes") || "").trim() || undefined,
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
  const name = String(fd.get("name") || "").trim();
  if (!name) return;
  const category = String(fd.get("category") || "OTHER").trim();
  if (!DOCUMENT_CATEGORIES.includes(category as typeof DOCUMENT_CATEGORIES[number])) return;
  let fileUrl: string | undefined;
  const rawUrl = String(fd.get("fileUrl") || "").trim();
  if (rawUrl) {
    try { fileUrl = new URL(rawUrl).protocol === "https:" ? rawUrl : undefined; } catch { /* invalid URL */ }
  }
  await Documents.create({
    vehicleId,
    name,
    category,
    type: String(fd.get("type") || "PDF").trim() || "PDF",
    fileUrl,
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
  const title = String(fd.get("title") || "").trim();
  if (!title || !Number.isFinite(year)) return;
  if (year < 1700 || year > CURRENT_YEAR + 1) return;
  const category = String(fd.get("category") || "HISTORY").trim();
  if (!VALID_TIMELINE_CATEGORIES.has(category)) return;
  const eventDate = String(fd.get("eventDate") || "").trim();
  await Timeline.create({
    vehicleId,
    year,
    title,
    description: String(fd.get("description") || "").trim() || undefined,
    imageUrl: String(fd.get("imageUrl") || "").trim() || undefined,
    category: category as TimelineCategory,
    eventDate: eventDate && DATE_RE.test(eventDate) ? eventDate : undefined,
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
  const url = String(fd.get("url") || "").trim();
  if (!url) return;
  let validatedUrl: string | undefined;
  try { validatedUrl = new URL(url).protocol === "https:" ? url : undefined; } catch { /* invalid */ }
  if (!validatedUrl) return;
  await Gallery.create({ vehicleId, url: validatedUrl, caption: String(fd.get("caption") || "").trim() || undefined });
  revalidatePath(`/dashboard/collection/${vehicleId}/gallery`);
}
export async function deleteGalleryImage(vehicleId: string, imageId: string) {
  await ownGuard(vehicleId);
  await Gallery.remove(imageId, vehicleId);
  revalidatePath(`/dashboard/collection/${vehicleId}/gallery`);
}