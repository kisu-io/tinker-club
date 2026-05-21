import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Clubs, Shares, Bookings } from "@/lib/repo";
import { VehicleImage } from "@/components/VehicleImage";
import { StatusPill } from "@/components/StatusPill";
import { formatDate } from "@/lib/format";
import { CreateClubButton, JoinClubButton } from "./ClubButtons";
import { BookForm, DecisionButtons, CancelButton } from "./BookingButtons";
import { ChevronRight } from "@/components/icons";

export default async function SharingPage() {
  const user = await requireUser();
  const clubs = Clubs.forUser(user.id);
  const bookable = Shares.bookableFor(user.id);
  const myBookings = Bookings.byBorrower(user.id);
  const incoming = Bookings.incomingFor(user.id).filter((b) => b.status === "PENDING");

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Car sharing</h1>
          <p className="text-sm text-ink-500">Share cars with people you trust, and borrow theirs.</p>
        </div>
        <div className="flex gap-2">
          <JoinClubButton />
          <CreateClubButton />
        </div>
      </div>

      {incoming.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-ink-500">Requests awaiting your approval</h2>
          <div className="space-y-2">
            {incoming.map((b) => (
              <div key={b.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="text-sm">
                  <p className="font-medium text-ink-900">{b.borrowerName} · {b.year} {b.make} {b.model}</p>
                  <p className="text-ink-500">{formatDate(b.startDate)} → {formatDate(b.endDate)}{b.purpose ? ` · ${b.purpose}` : ""}</p>
                </div>
                <DecisionButtons bookingId={b.id} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-500">Your clubs</h2>
        {clubs.length === 0 ? (
          <div className="card p-8 text-center text-sm text-ink-400">
            You&apos;re not in any clubs yet. Create one to share your cars, or join with an invite code.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clubs.map((c) => (
              <Link key={c.id} href={`/dashboard/sharing/${c.id}`} className="card group p-5 transition hover:shadow-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-ink-900">{c.name}</p>
                    {c.description && <p className="mt-0.5 line-clamp-2 text-sm text-ink-500">{c.description}</p>}
                  </div>
                  <ChevronRight className="h-5 w-5 text-ink-300 group-hover:text-ink-600" />
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span className="pill bg-ink-100 text-ink-600">{c.memberCount} member{c.memberCount === 1 ? "" : "s"}</span>
                  <span className="pill bg-ink-50 text-ink-500">{c.role[0] + c.role.slice(1).toLowerCase()}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-500">Available to borrow</h2>
        {bookable.length === 0 ? (
          <div className="card p-8 text-center text-sm text-ink-400">
            No cars are shared with your clubs yet.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bookable.map((v) => (
              <div key={v.id} className="card overflow-hidden">
                <VehicleImage src={v.imageUrl} alt={`${v.make} ${v.model}`} className="h-40 w-full" />
                <div className="p-4">
                  <p className="text-xs text-ink-400">{v.year} · {v.clubName}</p>
                  <p className="font-medium text-ink-900">{v.make} {v.model}</p>
                  <p className="mt-0.5 text-xs text-ink-500">Owner: {v.ownerName}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="pill bg-ink-50 text-ink-500">
                      {v.requireApproval ? "Approval needed" : "Instant book"}
                    </span>
                    <BookForm vehicleId={v.id} requireApproval={!!v.requireApproval} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-500">Your bookings</h2>
        {myBookings.length === 0 ? (
          <div className="card p-8 text-center text-sm text-ink-400">No bookings yet.</div>
        ) : (
          <div className="space-y-2">
            {myBookings.map((b) => (
              <div key={b.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="text-sm">
                  <p className="font-medium text-ink-900">{b.year} {b.make} {b.model}</p>
                  <p className="text-ink-500">{formatDate(b.startDate)} → {formatDate(b.endDate)} · {b.ownerName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={b.status} />
                  <Link href={`/dashboard/sharing/booking/${b.id}`} className="btn-ghost text-xs">Handover</Link>
                  {(b.status === "PENDING" || b.status === "APPROVED") && <CancelButton bookingId={b.id} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
