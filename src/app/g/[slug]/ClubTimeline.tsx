import Link from "next/link";
import type { CalendarEntry } from "@/lib/repo";
import { addDays, dayLabel } from "@/lib/calendar";
import { formatRange, slotOf, startSlot, endSlot } from "@/lib/slots";
import { STATUS_STYLE } from "@/components/MonthGrid";
import { ChevronLeft, ChevronRight } from "@/components/icons";

export const TIMELINE_DAYS = 14;
const COLS = TIMELINE_DAYS * 2; // AM + PM per day

interface TimelineCar { id: string; make: string; model: string; year: number; ownerId: string; ownerName: string }

const TEXT: Record<CalendarEntry["status"], string> = { APPROVED: "text-white", PENDING: "text-amber-950", BLOCKED: "text-ink-700" };

/**
 * Club timeline: rows are cars, columns are half-days from `from`. Server-rendered; week navigation
 * via `?from=YYYY-MM-DD`. Every member sees who booked what (Q5); block reasons stay with the owner.
 */
export function ClubTimeline({ cars, entries, from, today, viewerId, basePath }: {
  cars: TimelineCar[]; entries: CalendarEntry[]; from: string; today: string; viewerId: string; basePath: string;
}) {
  const days = Array.from({ length: TIMELINE_DAYS }, (_, i) => addDays(from, i));
  const base = slotOf(from, "AM");
  const track = { gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` };
  const nav = "flex h-8 w-8 items-center justify-center rounded-full border border-ink-200 text-ink-600 transition-colors duration-200 hover:bg-ink-50";

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-ink-700">Who has what, when</h2>
        <div className="flex items-center gap-2">
          <Link href={`${basePath}?from=${addDays(from, -7)}`} className={nav} aria-label="Previous week"><ChevronLeft className="h-4 w-4" /></Link>
          <Link href={basePath} className="text-xs text-ink-500 hover:text-ink-900">Today</Link>
          <Link href={`${basePath}?from=${addDays(from, 7)}`} className={nav} aria-label="Next week"><ChevronRight className="h-4 w-4" /></Link>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[9rem_minmax(0,1fr)] items-end gap-3">
            <span />
            <div className="grid" style={track}>
              {days.map((d) => (
                <span key={d} className={`col-span-2 text-center text-[11px] leading-tight ${d === today ? "font-semibold text-accent-600" : "text-ink-500"}`}>
                  {new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`))}
                  <br />{dayLabel(d)}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-2 divide-y divide-ink-50">
            {cars.map((car) => (
              <div key={car.id} className="grid grid-cols-[9rem_minmax(0,1fr)] items-center gap-3 py-2">
                <div className="sticky left-0 z-20 min-w-0 bg-white text-sm">
                  <p className="truncate font-medium text-ink-900">{car.make} {car.model}</p>
                  <p className="truncate text-xs text-ink-400">{car.ownerId === viewerId ? "Yours" : car.ownerName}</p>
                </div>
                <div className="grid h-8" style={track}>
                  {days.map((d, i) => (
                    <span key={d} style={{ gridRow: 1, gridColumn: `${i * 2 + 1} / span 2` }}
                      className={`border-l border-ink-100 ${d === today ? "bg-accent-50" : ""}`} />
                  ))}
                  {entries.filter((e) => e.vehicleId === car.id).map((e) => {
                    const s = Math.max(0, startSlot(e) - base);
                    const end = Math.min(COLS - 1, endSlot(e) - base);
                    if (end < 0 || s > COLS - 1) return null;
                    const label = e.kind === "BLOCK" ? (car.ownerId === viewerId ? e.label : "Blocked") : e.label;
                    const what = e.status === "PENDING" ? "Requested" : e.status === "BLOCKED" ? "Blocked" : "Booked";
                    return (
                      <span key={e.id} title={`${what}: ${label} (${formatRange(e)})`}
                        style={{ gridRow: 1, gridColumn: `${s + 1} / ${end + 2}` }}
                        className={`z-10 mx-px my-1 flex items-center overflow-hidden rounded-md px-1.5 text-[11px] font-medium ${STATUS_STYLE[e.status]} ${TEXT[e.status]}`}>
                        <span className="truncate">{label}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
