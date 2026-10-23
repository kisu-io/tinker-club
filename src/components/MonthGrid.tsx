// Presentational month grid with AM/PM halves. No hooks, so it renders on the server (Share tab)
// or inside a client component (booking form, where onPickDay makes days clickable).
import { monthWeeks } from "@/lib/calendar";
import { slotOf, startSlot, endSlot, type Half, type SlotRange } from "@/lib/slots";

export type GridStatus = "APPROVED" | "PENDING" | "BLOCKED";
export type GridEntry = SlotRange & { status: GridStatus; label: string };

export const STATUS_STYLE: Record<GridStatus, string> = {
  APPROVED: "bg-ink-800",
  PENDING: "bg-amber-300",
  BLOCKED: "bg-[repeating-linear-gradient(135deg,#cbd5e1_0_4px,#e2e8f0_4px_8px)]",
};

const STATUS_NAME: Record<GridStatus, string> = { APPROVED: "Booked", PENDING: "Requested", BLOCKED: "Blocked" };
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface MonthGridProps {
  month: string;
  entries: GridEntry[];
  today: string;
  selection?: SlotRange | null;
  onPickDay?: (date: string) => void;
}

function HalfBar({ date, half, entries, selection }: { date: string; half: Half; entries: GridEntry[]; selection?: SlotRange | null }) {
  const s = slotOf(date, half);
  const hit = entries.find((e) => startSlot(e) <= s && s <= endSlot(e));
  const selected = !!selection && startSlot(selection) <= s && s <= endSlot(selection);
  const style = hit ? STATUS_STYLE[hit.status] : selected ? "bg-accent-600" : "bg-ink-100";
  const title = `${half}: ${hit ? `${STATUS_NAME[hit.status]} · ${hit.label}` : selected ? "Your selection" : "Free"}`;
  return <span title={title} className={`h-2 flex-1 transition-colors duration-200 ${style} ${half === "AM" ? "rounded-l-full" : "rounded-r-full"}`} />;
}

export function MonthGrid({ month, entries, today, selection, onPickDay }: MonthGridProps) {
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wide text-ink-400">
        {WEEKDAYS.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {monthWeeks(month).flat().map((date, i) => {
          if (!date) return <span key={i} />;
          const past = date < today;
          const body = (
            <>
              <span className={`text-xs ${date === today ? "font-semibold text-accent-600" : "text-ink-700"}`}>{Number(date.slice(8))}</span>
              <span className="mt-1 flex w-full gap-px">
                <HalfBar date={date} half="AM" entries={entries} selection={selection} />
                <HalfBar date={date} half="PM" entries={entries} selection={selection} />
              </span>
            </>
          );
          const cell = `flex flex-col items-center rounded-lg border border-ink-100 bg-white px-1 py-1.5 ${past ? "opacity-40" : ""}`;
          return onPickDay && !past ? (
            <button key={date} type="button" onClick={() => onPickDay(date)} aria-label={date}
              className={`${cell} cursor-pointer transition-colors duration-200 hover:border-ink-400`}>
              {body}
            </button>
          ) : (
            <div key={date} className={cell}>{body}</div>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarLegend({ withSelection = false }: { withSelection?: boolean }) {
  const items: [string, string][] = [
    ["bg-ink-100", "Free"],
    [STATUS_STYLE.APPROVED, "Booked"],
    [STATUS_STYLE.PENDING, "Requested"],
    [STATUS_STYLE.BLOCKED, "Blocked"],
    ...(withSelection ? [["bg-accent-600", "Your pick"] as [string, string]] : []),
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
      {items.map(([cls, name]) => (
        <span key={name} className="inline-flex items-center gap-1.5"><span className={`h-2 w-4 rounded-full ${cls}`} />{name}</span>
      ))}
      <span className="text-ink-400">Each day: morning | afternoon</span>
    </div>
  );
}

/** Strip repo calendar rows to what the grid needs (no ids) before handing them to a client component. */
export const toGridEntries = (rows: (SlotRange & { status: GridStatus; label: string })[]): GridEntry[] =>
  rows.map(({ startDate, startHalf, endDate, endHalf, status, label }) => ({ startDate, startHalf, endDate, endHalf, status, label }));
