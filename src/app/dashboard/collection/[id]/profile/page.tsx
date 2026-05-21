import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Vehicles, Timeline } from "@/lib/repo";
import { VehicleImage } from "@/components/VehicleImage";
import { formatDate } from "@/lib/format";
import { EditProfileButton, ChangeImageButton } from "./EditProfile";
import { EditTechnicalButton, EditFactsButton } from "./TechnicalEditor";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-[11px] uppercase tracking-wide text-ink-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink-900">{value}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  const display = value === null || value === undefined || value === "" ? "–" : String(value);
  return (
    <div className="flex items-center justify-between border-b border-ink-50 py-2.5 last:border-0">
      <span className="text-xs uppercase tracking-wide text-ink-400">{label}</span>
      <span className="text-sm font-medium text-ink-900">{display}</span>
    </div>
  );
}

const STAT_LABELS: Record<string, string> = {
  SERVICE: "Service",
  RESTORATION: "Restoration",
  ADMIN: "Admin",
  HISTORY: "History",
};

export default async function ProfilePage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const v = Vehicles.forOwner(params.id, user.id);
  if (!v) notFound();

  const facts: string[] = v.keyFacts ? JSON.parse(v.keyFacts) : [];
  const stats = Timeline.stats(v.id);
  const upcoming = Timeline.upcoming(v.id);

  return (
    <div className="space-y-8">
      {/* Hero + key specs */}
      <div>
        <div className="relative overflow-hidden rounded-2xl">
          <VehicleImage src={v.imageUrl} alt={`${v.make} ${v.model}`} className="h-[280px] w-full sm:h-[400px]" />
          <div className="absolute right-4 top-4">
            <ChangeImageButton vehicle={v} />
          </div>
        </div>

        <div className="card mt-4 flex items-center justify-between gap-4 p-5">
          <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Model" value={v.model} />
            <Stat label="Cylinders" value={v.cylinders ? String(v.cylinders) : "–"} />
            <Stat label="Performance" value={v.performanceKw ? `${v.performanceKw} kW` : "– kW"} />
            <Stat label="Mileage" value={`${v.mileageKm.toLocaleString()} km`} />
          </div>
          <EditProfileButton vehicle={v} />
        </div>
      </div>

      {/* Technical information */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Technical information</h2>
          <EditTechnicalButton vehicle={v} />
        </div>
        <div className="card grid gap-x-10 gap-y-1 p-5 md:grid-cols-2">
          <div>
            <p className="mb-1 text-sm font-semibold text-ink-700">General</p>
            <Field label="Vehicle type" value={v.vehicleType} />
            <Field label="Body style" value={v.bodyStyle} />
            <Field label="Owner" value={user.name} />
            <Field label="Previous owners" value={v.previousOwners} />
            <Field label="Number of units produced" value={v.unitsProduced} />
            <Field label="VIN number" value={v.vin} />
            <Field label="Transmission number" value={v.transmissionNumber} />
            <Field label="Mileage (km)" value={v.mileageKm ? v.mileageKm.toLocaleString() : null} />
            <Field label="Location" value={v.location} />
          </div>
          <div>
            <p className="mb-1 text-sm font-semibold text-ink-700">Drive</p>
            <Field label="Gearbox" value={v.gearbox} />
            <Field label="Drive type" value={v.driveType} />
            <Field label="Driver's side" value={v.driversSide} />
            <Field label="Matching numbers" value={v.matchingNumbers ? "YES" : "NO"} />
          </div>
        </div>
      </section>

      {/* Key moments & Facts */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Key moments &amp; Facts</h2>
          <EditFactsButton vehicle={v} />
        </div>
        {facts.length === 0 && !v.overview ? (
          <div className="card p-6 text-center text-sm text-ink-400">
            No facts yet. Use the edit button to add key moments and an overview.
          </div>
        ) : (
          <div className="card grid gap-6 p-5 md:grid-cols-2">
            <ol className="space-y-3">
              {facts.map((f, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-md bg-ink-100 text-xs font-semibold text-ink-600">{i + 1}</span>
                  <span className="text-ink-800">{f}</span>
                </li>
              ))}
            </ol>
            {v.overview && <p className="text-sm leading-relaxed text-ink-500">{v.overview}</p>}
          </div>
        )}
      </section>

      {/* Upcoming events */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Upcoming events</h2>
          <Link href={`/dashboard/collection/${v.id}/timeline`} className="btn-ghost text-xs">Add event</Link>
        </div>
        {upcoming.length === 0 ? (
          <div className="card p-6 text-center text-sm text-ink-400">
            No upcoming events. Add a timeline event with a future date to see it here.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((e) => (
              <div key={e.id} className="card p-4">
                <p className="text-xs font-medium text-ink-400">{e.eventDate ? formatDate(e.eventDate) : e.year}</p>
                <p className="font-medium text-ink-900">{e.title}</p>
                {e.description && <p className="mt-1 text-sm text-ink-600">{e.description}</p>}
                <span className="pill mt-2 bg-ink-50 text-ink-500">{STAT_LABELS[e.category] ?? e.category}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Timeline stats */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Timeline stats</h2>
          <Link href={`/dashboard/collection/${v.id}/timeline`} className="text-sm font-medium text-ink-700 hover:underline">
            View Timeline →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(["SERVICE", "RESTORATION", "ADMIN", "HISTORY"] as const).map((k) => (
            <div key={k} className="stat-card text-center">
              <p className="text-2xl font-semibold">{stats[k]}</p>
              <p className="text-xs uppercase tracking-wide text-ink-500">{STAT_LABELS[k]}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
