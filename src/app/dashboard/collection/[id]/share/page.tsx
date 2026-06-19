import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Vehicles, Clubs, Shares, Bookings } from "@/lib/repo";
import { StatusPill } from "@/components/StatusPill";
import { formatDate } from "@/lib/format";
import { ShareForm, UnshareButton } from "./ShareControls";
import { DecisionButtons, CancelButton } from "../../../sharing/BookingButtons";

export default async function SharePage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const v = await Vehicles.forOwner(params.id, user.id);
  if (!v) notFound();

  const myClubs = (await Clubs.forUser(user.id)).map((c) => ({ id: c.id, name: c.name }));
  const shares = await Shares.forVehicle(v.id);
  const sharedClubIds = new Set(shares.map((s) => s.clubId));
  const availableClubs = myClubs.filter((c) => !sharedClubIds.has(c.id));
  const bookings = await Bookings.forVehicle(v.id);
  const pending = bookings.filter((b) => b.status === "PENDING");
  const upcoming = bookings.filter((b) => b.status === "APPROVED");

  return (
    <div className="space-y-7">
      <section className="card p-5">
        <h2 className="mb-1 text-sm font-medium text-ink-700">Share this car</h2>
        <p className="mb-4 text-sm text-ink-500">
          Make this car bookable by members of your clubs. You stay in control of approvals.
        </p>
        <ShareForm vehicleId={v.id} clubs={availableClubs} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-500">Shared with</h2>
        {shares.length === 0 ? (
          <div className="card p-6 text-center text-sm text-ink-400">Not shared with any club yet.</div>
        ) : (
          <div className="card divide-y divide-ink-50">
            {shares.map((s) => (
              <div key={s.shareId} className="flex items-center justify-between p-4">
                <div className="text-sm">
                  <p className="font-medium text-ink-900">{s.clubName}</p>
                  <p className="text-ink-400">{s.requireApproval ? "Approval required" : "Instant booking"}</p>
                </div>
                <UnshareButton vehicleId={v.id} clubId={s.clubId} />
              </div>
            ))}
          </div>
        )}
      </section>

      {pending.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-ink-500">Booking requests</h2>
          <div className="space-y-2">
            {pending.map((b) => (
              <div key={b.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="text-sm">
                  <p className="font-medium text-ink-900">{b.borrowerName}</p>
                  <p className="text-ink-500">{formatDate(b.startDate)} → {formatDate(b.endDate)}{b.purpose ? ` · ${b.purpose}` : ""}</p>
                </div>
                <DecisionButtons bookingId={b.id} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-500">Upcoming bookings</h2>
        {upcoming.length === 0 ? (
          <div className="card p-6 text-center text-sm text-ink-400">No confirmed bookings.</div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((b) => (
              <div key={b.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="text-sm">
                  <p className="font-medium text-ink-900">{b.borrowerName}</p>
                  <p className="text-ink-500">{formatDate(b.startDate)} → {formatDate(b.endDate)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={b.status} />
                  <CancelButton bookingId={b.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
