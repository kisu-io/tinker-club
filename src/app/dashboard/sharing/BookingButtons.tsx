"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { SubmitButton } from "@/components/SubmitButton";
import { MonthGrid, CalendarLegend, type GridEntry } from "@/components/MonthGrid";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { monthLabel, shiftMonth } from "@/lib/calendar";
import { formatRange, type SlotRange } from "@/lib/slots";
import { requestBooking, decideBooking, cancelBooking } from "./actions";
import { RangeFields, pickDay, wholeDay } from "./RangeFields";

export function BookForm({
  vehicleId,
  requireApproval,
  entries,
  label = "Request booking",
}: {
  vehicleId: string;
  requireApproval: boolean;
  /** Upcoming bookings and blocks on this car, shown in the form's calendar. */
  entries: GridEntry[];
  label?: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<Awaited<ReturnType<typeof requestBooking>> | null>(null);
  const [range, setRange] = useState<SlotRange>(wholeDay(today));
  const [month, setMonth] = useState(today.slice(0, 7));
  const [extending, setExtending] = useState(false); // after a first calendar click, the next one sets the end
  const router = useRouter();

  async function action(fd: FormData) {
    const res = await requestBooking(fd);
    setMsg(res ?? null);
    if (res && "ok" in res && res.ok) {
      router.refresh();
      setTimeout(() => setOpen(false), 900);
    }
  }

  const nextFree = msg && "nextFree" in msg ? msg.nextFree : undefined;
  const confirmed = msg && "status" in msg && msg.status === "APPROVED";
  const nav = "flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-ink-200 text-ink-600 transition-colors duration-200 hover:bg-ink-50";

  return (
    <>
      <button onClick={() => { setMsg(null); setOpen(true); }} className="btn-primary text-sm">{label}</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Request a booking">
        <form action={action} className="space-y-4">
          <input type="hidden" name="vehicleId" value={vehicleId} />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ink-800">{monthLabel(month)}</p>
              <div className="flex gap-2">
                <button type="button" className={nav} aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft className="h-4 w-4" /></button>
                <button type="button" className={nav} aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
            <MonthGrid month={month} entries={entries} today={today} selection={range}
              onPickDay={(d) => { setMsg(null); setRange(pickDay(range, d, extending)); setExtending(!(extending && d > range.startDate)); }} />
            <CalendarLegend withSelection />
          </div>
          <RangeFields value={range} min={today} className="grid gap-3" onChange={(r) => { setMsg(null); setRange(r); }} />
          <div>
            <label className="label">Purpose (optional)</label>
            <input name="purpose" className="input" placeholder="Weekend trip, show, etc." />
          </div>
          <p className="rounded-lg bg-ink-50 p-2 text-xs text-ink-500">
            {requireApproval
              ? "The owner will review and approve this request. Unanswered requests expire after 48 hours."
              : "Instant booking — no approval needed for this car."}
          </p>
          {msg && "error" in msg && msg.error && (
            <div className="space-y-2 text-sm text-red-600">
              <p>{msg.error}</p>
              {nextFree && (
                <button type="button" className="btn-ghost text-xs"
                  onClick={() => { setRange(nextFree); setMonth(nextFree.startDate.slice(0, 7)); setMsg(null); }}>
                  Use {formatRange(nextFree)}
                </button>
              )}
            </div>
          )}
          {msg && "ok" in msg && msg.ok && (
            <p className="text-sm text-emerald-600">Booking {confirmed ? "confirmed" : "requested"}!</p>
          )}
          <SubmitButton pendingText="Submitting…">{requireApproval ? "Send request" : "Book now"}</SubmitButton>
        </form>
      </Modal>
    </>
  );
}

export function DecisionButtons({ bookingId }: { bookingId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  function decide(d: "APPROVED" | "DECLINED") {
    start(async () => { const res = await decideBooking(bookingId, d); if (res?.error) alert(res.error); router.refresh(); });
  }
  return (
    <div className="flex gap-2">
      <button disabled={pending} onClick={() => decide("APPROVED")} className="btn bg-emerald-600 text-white hover:bg-emerald-700 text-xs disabled:opacity-50">Approve</button>
      <button disabled={pending} onClick={() => decide("DECLINED")} className="btn-ghost text-xs disabled:opacity-50">Decline</button>
    </div>
  );
}

export function CancelButton({ bookingId }: { bookingId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      disabled={pending}
      onClick={() => { if (confirm("Cancel this booking?")) start(async () => { const res = await cancelBooking(bookingId); if (res?.error) alert(res.error); router.refresh(); }); }}
      className="btn-ghost text-xs disabled:opacity-50"
    >
      Cancel
    </button>
  );
}
