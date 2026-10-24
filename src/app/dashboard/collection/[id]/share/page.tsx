import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Vehicles, Clubs, Shares, Bookings, Blocks, Calendar } from "@/lib/repo";
import { StatusPill } from "@/components/StatusPill";
import { CarCalendar } from "@/components/CarCalendar";
import { toGridEntries } from "@/components/MonthGrid";
import { parseMonth, shiftMonth, todayUtc } from "@/lib/calendar";
import { formatRange } from "@/lib/slots";
import { ShareForm, UnshareButton } from "./ShareControls";
import { AddBlockForm, RemoveBlockButton } from "./BlockControls";
import { DecisionButtons, CancelButton } from "../../../sharing/BookingButtons";

export default async function SharePage({ params, searchParams }: { params: { id: string }; searchParams: { month?: string } }) {
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
  const today = todayUtc();
  const month = parseMonth(searchParams.month, today);
  const calendar = await Calendar.busy({ userId: user.id }, [v.id], `${month}-01`, `${shiftMonth(month, 1)}-01`);
  const blocks = (await Blocks.forVehicle(v.id)).filter((k) => k.endDate >= today);

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

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-medium text-ink-700">Calendar</h2>
        <CarCalendar month={month} entries={toGridEntries(calendar)} today={today} basePath={`/dashboard/collection/${v.id}/share`} />
      </section>

      <section className="card p-5">
        <h2 className="mb-1 text-sm font-medium text-ink-700">Block dates</h2>
        <p className="mb-4 text-sm text-ink-500">
          Keep the car for yourself (own use, service, a show). Members can&apos;t book blocked dates.
        </p>
        <AddBlockForm vehicleId={v.id} />
        {blocks.length > 0 && (
          <div className="mt-4 divide-y divide-ink-50 border-t border-ink-100">
            {blocks.map((k) => (
              <div key={k.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium text-ink-900">{formatRange(k)}</p>
                  {k.reason && <p className="text-ink-500">{k.reason}</p>}
                </div>
                <RemoveBlockButton blockId={k.id} />
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
                  <p className="text-ink-500">{formatRange(b)}{b.purpose ? ` · ${b.purpose}` : ""}</p>
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
                  <p className="text-ink-500">{formatRange(b)}</p>
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
