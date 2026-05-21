import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Clubs, Memberships, Shares } from "@/lib/repo";
import { VehicleImage } from "@/components/VehicleImage";
import { ChevronLeft } from "@/components/icons";
import { InviteCode, LeaveClubButton } from "./ClubControls";
import { BookForm } from "../BookingButtons";

export default async function ClubPage({ params }: { params: { clubId: string } }) {
  const user = await requireUser();
  const club = Clubs.byId(params.clubId);
  if (!club) notFound();
  const membership = Memberships.of(club.id, user.id);
  if (!membership) notFound();

  const members = Memberships.forClub(club.id);
  const shared = Shares.forClub(club.id);
  const isOwner = club.ownerId === user.id;

  return (
    <div className="space-y-7">
      <div>
        <Link href="/dashboard/sharing" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800">
          <ChevronLeft className="h-4 w-4" /> Sharing
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{club.name}</h1>
            {club.description && <p className="text-sm text-ink-500">{club.description}</p>}
          </div>
          <div className="flex items-center gap-2">
            <InviteCode code={club.inviteCode} />
            {!isOwner && <LeaveClubButton clubId={club.id} />}
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-500">Members ({members.length})</h2>
        <div className="card divide-y divide-ink-50">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-100 text-xs font-semibold text-ink-600">
                  {m.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                </span>
                <div className="text-sm">
                  <p className="font-medium text-ink-900">{m.name}{m.userId === user.id ? " (you)" : ""}</p>
                  <p className="text-ink-400">{m.email}</p>
                </div>
              </div>
              <span className="pill bg-ink-50 text-ink-500">{m.role[0] + m.role.slice(1).toLowerCase()}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-500">Cars in this club ({shared.length})</h2>
        {shared.length === 0 ? (
          <div className="card p-8 text-center text-sm text-ink-400">
            No cars shared here yet. Open a car in your collection → <span className="font-medium">Share</span> tab to add one.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shared.map((v: any) => {
              const mine = v.ownerId === user.id;
              return (
                <div key={v.id} className="card overflow-hidden">
                  <VehicleImage src={v.imageUrl} alt={`${v.make} ${v.model}`} className="h-40 w-full" />
                  <div className="p-4">
                    <p className="text-xs text-ink-400">{v.year} · Owner: {v.ownerName}{mine ? " (you)" : ""}</p>
                    <p className="font-medium text-ink-900">{v.make} {v.model}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="pill bg-ink-50 text-ink-500">{v.requireApproval ? "Approval needed" : "Instant book"}</span>
                      {mine ? (
                        <Link href={`/dashboard/collection/${v.id}/share`} className="btn-ghost text-xs">Manage</Link>
                      ) : (
                        <BookForm vehicleId={v.id} requireApproval={!!v.requireApproval} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
