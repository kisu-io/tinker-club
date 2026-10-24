import Link from "next/link";
import { monthLabel, shiftMonth } from "@/lib/calendar";
import { ChevronLeft, ChevronRight } from "./icons";
import { MonthGrid, CalendarLegend, type GridEntry } from "./MonthGrid";

/** Server-rendered car month calendar; prev/next navigate via `?month=YYYY-MM` (no client state, no polling). */
export function CarCalendar({ month, entries, today, basePath }: { month: string; entries: GridEntry[]; today: string; basePath: string }) {
  const nav = "flex h-8 w-8 items-center justify-center rounded-full border border-ink-200 text-ink-600 transition-colors duration-200 hover:bg-ink-50";
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-display text-lg font-semibold text-ink-900">{monthLabel(month)}</p>
        <div className="flex items-center gap-2">
          <Link href={`${basePath}?month=${shiftMonth(month, -1)}`} className={nav} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Link>
          <Link href={basePath} className="text-xs text-ink-500 hover:text-ink-900">Today</Link>
          <Link href={`${basePath}?month=${shiftMonth(month, 1)}`} className={nav} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Link>
        </div>
      </div>
      <MonthGrid month={month} entries={entries} today={today} />
      <CalendarLegend />
    </div>
  );
}
