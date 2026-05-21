"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { SubmitButton } from "@/components/SubmitButton";
import { requestBooking, decideBooking, cancelBooking } from "./actions";

export function BookForm({
  vehicleId,
  requireApproval,
  label = "Request booking",
}: {
  vehicleId: string;
  requireApproval: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; ok?: boolean } | null>(null);
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  async function action(fd: FormData) {
    const res = await requestBooking(fd);
    setMsg(res ?? null);
    if (res && "ok" in res && res.ok) {
      router.refresh();
      setTimeout(() => setOpen(false), 900);
    }
  }

  return (
    <>
      <button onClick={() => { setMsg(null); setOpen(true); }} className="btn-primary text-sm">{label}</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Request a booking">
        <form action={action} className="space-y-4">
          <input type="hidden" name="vehicleId" value={vehicleId} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">From</label>
              <input name="startDate" type="date" min={today} defaultValue={today} className="input" required />
            </div>
            <div>
              <label className="label">To</label>
              <input name="endDate" type="date" min={today} defaultValue={today} className="input" required />
            </div>
          </div>
          <div>
            <label className="label">Purpose (optional)</label>
            <input name="purpose" className="input" placeholder="Weekend trip, show, etc." />
          </div>
          <p className="rounded-lg bg-ink-50 p-2 text-xs text-ink-500">
            {requireApproval
              ? "The owner will review and approve this request."
              : "Instant booking — no approval needed for this car."}
          </p>
          {msg?.error && <p className="text-sm text-red-600">{msg.error}</p>}
          {msg && "ok" in msg && msg.ok && (
            <p className="text-sm text-emerald-600">Booking {requireApproval ? "requested" : "confirmed"}!</p>
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
    start(async () => { await decideBooking(bookingId, d); router.refresh(); });
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
      onClick={() => { if (confirm("Cancel this booking?")) start(async () => { await cancelBooking(bookingId); router.refresh(); }); }}
      className="btn-ghost text-xs disabled:opacity-50"
    >
      Cancel
    </button>
  );
}
