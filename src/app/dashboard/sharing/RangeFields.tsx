"use client";

import type { Half, SlotRange } from "@/lib/slots";

/** Controlled From/To date + morning/afternoon fields; submits startDate/startHalf/endDate/endHalf. */
export function RangeFields({ value, onChange, min, className = "grid gap-3 sm:grid-cols-2" }: {
  value: SlotRange; onChange: (r: SlotRange) => void; min: string; className?: string;
}) {
  const field = (k: keyof SlotRange, v: string) => onChange({ ...value, [k]: v });
  const row = (label: string, dateKey: "startDate" | "endDate", halfKey: "startHalf" | "endHalf") => (
    <div>
      <label className="label" htmlFor={dateKey}>{label}</label>
      <div className="flex gap-2">
        <input id={dateKey} name={dateKey} type="date" min={min} value={value[dateKey]} required className="input min-w-0 flex-1"
          onChange={(e) => field(dateKey, e.target.value)} />
        <select name={halfKey} aria-label={`${label} half`} value={value[halfKey]} className="input w-auto shrink-0"
          onChange={(e) => field(halfKey, e.target.value as Half)}>
          <option value="AM">Morning</option>
          <option value="PM">Afternoon</option>
        </select>
      </div>
    </div>
  );
  return (
    <div className={className}>
      {row("From", "startDate", "startHalf")}
      {row("To", "endDate", "endHalf")}
    </div>
  );
}

export const wholeDay = (date: string): SlotRange => ({ startDate: date, startHalf: "AM", endDate: date, endHalf: "PM" });

/** Calendar clicks: the first picks a whole day; the next, if later, extends that pick to it. */
export function pickDay(current: SlotRange, date: string, extending: boolean): SlotRange {
  return extending && date > current.startDate ? { ...current, endDate: date, endHalf: "PM" } : wholeDay(date);
}
