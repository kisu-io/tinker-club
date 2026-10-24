import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Clubs, Shares, Bookings, Calendar } from "@/lib/repo";
import { VehicleImage } from "@/components/VehicleImage";
import { StatusPill } from "@/components/StatusPill";
import { toGridEntries } from "@/components/MonthGrid";
import { todayUtc } from "@/lib/calendar";
import { formatRange } from "@/lib/slots";
import { buildAgenda, type AgendaItem } from "@/lib/agenda";
import { CreateClubButton, JoinClubButton } from "./ClubButtons";
import { BookForm, DecisionButtons, CancelButton } from "./BookingButtons";
import { ChevronRight } from "@/components/icons";

const ACTION_LABEL = { PICKUP: "Log pickup", RETURN: "Log return" } as const;

function AgendaCard({ b, children }: { b: AgendaItem; children: React.ReactNode }) {
  const who = b.role === "OWNER" ? `${b.borrowerName} is borrowing your car` : `Borrowing from ${b.ownerName}`;
  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="text-sm">
        <p className="font-medium text-ink-900">{b.year} {b.make} {b.model}</p>
        <p className="text-ink-500">{formatRange(b)} · {who}{b.purpose ? ` · ${b.purpose}` : ""}</p>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export default async function SharingPage() {
  const user = await requireUser();
  const today = todayUtc();
  const clubs = await Clubs.forUser(user.id);
  const bookable = await Shares.bookableFor(user.id);
  const busy = await Calendar.busy({ userId: user.id }, Array.from(new Set(bookable.map((v) => v.id))), today);
  const agenda = buildAgenda(await Bookings.agendaFor(user.id), user.id, today);

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

      {agenda.needsAction.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-ink-500">Needs your action</h2>
          <div className="space-y-2">
            {agenda.needsAction.map((b) => (
              <AgendaCard key={b.id} b={b}>
                {b.action === "DECIDE" ? (
                  <DecisionButtons bookingId={b.id} />
                ) : (
                  <Link href={`/dashboard/sharing/booking/${b.id}`} className="btn-primary text-xs">{ACTION_LABEL[b.action!]}</Link>
                )}
                {b.action === "PICKUP" && <CancelButton bookingId={b.id} />}
              </AgendaCard>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-500">Upcoming</h2>
        {agenda.upcoming.length === 0 ? (
          <div className="card p-8 text-center text-sm text-ink-400">Nothing coming up.</div>
        ) : (
          <div className="space-y-2">
            {agenda.upcoming.map((b) => (
              <AgendaCard key={b.id} b={b}>
                <StatusPill status={b.status} />
                <Link href={`/dashboard/sharing/booking/${b.id}`} className="btn-ghost text-xs">Handover</Link>
                {!b.pickedUp && <CancelButton bookingId={b.id} />}
              </AgendaCard>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-500">Your clubs</h2>
        {clubs.length === 0 ? (
          <div className="card p-8 text-center text-sm text-ink-400">
            You&apos;re not in any clubs yet. Create one to share your cars, or join with an invite code.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clubs.map((c) => (
              <Link key={c.id} href={`/g/${c.slug}`} className="card group p-5 transition hover:shadow-lg">
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
                    <BookForm vehicleId={v.id} requireApproval={!!v.requireApproval}
                      entries={toGridEntries(busy.filter((e) => e.vehicleId === v.id))} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {agenda.history.length > 0 && (
        <details className="group">
          <summary className="mb-3 cursor-pointer text-sm font-medium text-ink-500 hover:text-ink-800">Past and closed ({agenda.history.length})</summary>
          <div className="space-y-2">
            {agenda.history.map((b) => (
              <AgendaCard key={b.id} b={b}>
                <StatusPill status={b.status} />
                <Link href={`/dashboard/sharing/booking/${b.id}`} className="btn-ghost text-xs">Details</Link>
              </AgendaCard>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
