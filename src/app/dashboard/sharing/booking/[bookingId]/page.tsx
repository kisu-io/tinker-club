import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Bookings, Vehicles, Handovers, Users } from "@/lib/repo";
import { StatusPill } from "@/components/StatusPill";
import { ChevronLeft } from "@/components/icons";
import { formatDate } from "@/lib/format";
import { DEFAULT_HANDOVER_CHECKLIST } from "@/lib/constants";
import { HandoverForm } from "./HandoverForm";

export default async function BookingPage({ params }: { params: { bookingId: string } }) {
  const user = await requireUser();
  const booking = Bookings.byId(params.bookingId);
  if (!booking) notFound();
  const vehicle = Vehicles.byId(booking.vehicleId);
  if (!vehicle) notFound();

  const isOwner = vehicle.ownerId === user.id;
  const isBorrower = booking.borrowerId === user.id;
  if (!isOwner && !isBorrower) notFound();

  const borrower = Users.byId(booking.borrowerId);
  const owner = Users.byId(vehicle.ownerId);
  const handover = Handovers.forBooking(booking.id);
  const pickedUp = !!handover?.pickedUpAt;
  const returned = !!handover?.returnedAt;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/dashboard/sharing" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800">
          <ChevronLeft className="h-4 w-4" /> Sharing
        </Link>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{vehicle.year} {vehicle.make} {vehicle.model}</h1>
          <StatusPill status={booking.status} />
        </div>
        <p className="mt-1 text-sm text-ink-500">
          {formatDate(booking.startDate)} → {formatDate(booking.endDate)} · Borrower: {borrower?.name} · Owner: {owner?.name}
        </p>
        {booking.purpose && <p className="mt-1 text-sm text-ink-600">Purpose: {booking.purpose}</p>}
      </div>

      {booking.status === "PENDING" && (
        <div className="card p-5 text-sm text-ink-500">
          This booking is awaiting the owner&apos;s approval. The handover checklist unlocks once it&apos;s approved.
        </div>
      )}

      {(booking.status === "APPROVED" || booking.status === "COMPLETED") && (
        <>
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-ink-700">1 · Pickup checklist</h2>
              {pickedUp && <span className="pill bg-emerald-100 text-emerald-700">Done {handover?.pickedUpAt ? formatDate(handover.pickedUpAt) : ""}</span>}
            </div>
            <HandoverForm bookingId={booking.id} phase="pickup" checklist={[...DEFAULT_HANDOVER_CHECKLIST]} done={pickedUp} />
            {pickedUp && (
              <p className="mt-3 text-xs text-ink-400">
                Recorded: {handover?.pickupMileageKm ?? "–"} km · {handover?.pickupFuelPct ?? "–"}% fuel
              </p>
            )}
          </section>

          <section className={`card p-5 ${!pickedUp ? "pointer-events-none opacity-50" : ""}`}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-ink-700">2 · Return</h2>
              {returned && <span className="pill bg-sky-100 text-sky-700">Returned {handover?.returnedAt ? formatDate(handover.returnedAt) : ""}</span>}
            </div>
            {!pickedUp ? (
              <p className="text-sm text-ink-400">Complete pickup first.</p>
            ) : (
              <HandoverForm bookingId={booking.id} phase="return" checklist={[]} done={returned} />
            )}
            {returned && (
              <p className="mt-3 text-xs text-ink-400">
                Returned at {handover?.returnMileageKm ?? "–"} km · {handover?.returnFuelPct ?? "–"}% fuel
                {handover?.damageReported ? " · ⚠ damage reported" : ""}
              </p>
            )}
          </section>
        </>
      )}

      {(booking.status === "DECLINED" || booking.status === "CANCELLED") && (
        <div className="card p-5 text-sm text-ink-500">This booking is {booking.status.toLowerCase()}.</div>
      )}
    </div>
  );
}
