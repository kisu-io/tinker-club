// Half-day booking slots. A day has an AM and a PM slot; ranges are inclusive on both ends.
// Slot order is (date, half) with AM < PM, so a booking ending AM and one starting PM on the
// same day don't overlap (same-day turnover). Whole-day bookings are AM -> PM.

import { dayLabel } from "./calendar";

export type Half = "AM" | "PM";

export interface SlotRange {
  startDate: string; // YYYY-MM-DD
  startHalf: Half;
  endDate: string;
  endHalf: Half;
}

const DAY_MS = 86_400_000;

export const isHalf = (v: unknown): v is Half => v === "AM" || v === "PM";

export function slotOf(date: string, half: Half): number {
  return (Date.parse(`${date}T00:00:00Z`) / DAY_MS) * 2 + (half === "PM" ? 1 : 0);
}

export function fromSlot(slot: number): { date: string; half: Half } {
  const date = new Date(Math.floor(slot / 2) * DAY_MS).toISOString().slice(0, 10);
  return { date, half: slot % 2 ? "PM" : "AM" };
}

export const startSlot = (r: SlotRange) => slotOf(r.startDate, r.startHalf);
export const endSlot = (r: SlotRange) => slotOf(r.endDate, r.endHalf);

export const isValidRange = (r: SlotRange) => startSlot(r) <= endSlot(r);

export const rangesOverlap = (a: SlotRange, b: SlotRange) =>
  startSlot(a) <= endSlot(b) && startSlot(b) <= endSlot(a);

/** First range of the same length as `wanted`, starting at or after it, that overlaps none of `busy`. */
export function nextFree(busy: SlotRange[], wanted: SlotRange): SlotRange {
  const len = endSlot(wanted) - startSlot(wanted);
  let s = startSlot(wanted);
  for (const b of [...busy].sort((x, y) => startSlot(x) - startSlot(y))) {
    if (endSlot(b) < s) continue;
    if (startSlot(b) > s + len) break;
    s = endSlot(b) + 1;
  }
  const start = fromSlot(s);
  const end = fromSlot(s + len);
  return { startDate: start.date, startHalf: start.half, endDate: end.date, endHalf: end.half };
}

/** "5 Mar AM → 7 Mar PM" */
export const formatRange = (r: SlotRange) =>
  `${dayLabel(r.startDate)} ${r.startHalf} → ${dayLabel(r.endDate)} ${r.endHalf}`;
