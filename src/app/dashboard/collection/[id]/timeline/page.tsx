import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Vehicles, Timeline } from "@/lib/repo";
import { VehicleImage } from "@/components/VehicleImage";
import { DeleteButton } from "@/components/DeleteButton";
import { AddEventButton } from "./AddEventButton";
import { deleteTimelineEvent } from "../detail-actions";

export default async function TimelinePage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const v = await Vehicles.forOwner(params.id, user.id);
  if (!v) notFound();

  const events = await Timeline.forVehicle(v.id);

  return (
    <div>
      {/* Cinematic banner */}
      <div className="relative overflow-hidden rounded-2xl">
        <VehicleImage src={v.imageUrl} alt={`${v.make} ${v.model}`} className="h-52 w-full grayscale sm:h-72" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900/70 to-transparent" />
        <div className="absolute right-4 top-4">
          <AddEventButton vehicleId={v.id} />
        </div>
        <div className="absolute bottom-4 left-4 text-white">
          <p className="text-3xl font-bold">{v.year}</p>
          <p className="text-sm text-white/80">{events.length} milestone{events.length === 1 ? "" : "s"} recorded</p>
        </div>
      </div>

      {/* Vertical timeline */}
      <div className="relative mt-6 pl-6">
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-ink-200" />
        <div className="space-y-5">
          {events.map((e) => (
            <div key={e.id} className="relative">
              <span className="absolute -left-[22px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-ink-900" />
              <div className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-ink-400">{e.year}</p>
                    <h3 className="font-semibold text-ink-900">{e.title}</h3>
                    {e.description && <p className="mt-1 text-sm text-ink-600">{e.description}</p>}
                  </div>
                  <DeleteButton action={deleteTimelineEvent.bind(null, v.id, e.id)} confirm="Delete this event?" />
                </div>
                {e.imageUrl && (
                  <VehicleImage src={e.imageUrl} alt={e.title} className="mt-3 h-40 w-full rounded-xl" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
