import { requireUser } from "@/lib/auth";
import { Vehicles } from "@/lib/repo";
import { AddCarButton } from "./AddCarButton";
import { CollectionGrid, VehicleCardData } from "./CollectionGrid";

function firstName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts[parts.length - 1] ?? full;
}

export default async function CollectionPage() {
  const user = await requireUser();
  const vehicles = Vehicles.ownedBy(user.id);

  const data: VehicleCardData[] = vehicles.map((v) => ({
    id: v.id,
    year: v.year,
    make: v.make,
    model: v.model,
    imageUrl: v.imageUrl,
    visibility: v.visibility,
    sharedCount: Vehicles.shareCount(v.id),
  }));

  const count = data.length;
  const eyebrow =
    count === 0
      ? "Your collection"
      : `Your collection · ${count} ${count === 1 ? "car" : "cars"}`;

  return (
    <div>
      <div className="mb-8 flex flex-col gap-6 md:mb-12 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="h-display mt-3 text-[clamp(2.25rem,4vw,3.75rem)]">
            Hello, <span className="italic">{firstName(user.name)}</span>.
          </h1>
        </div>
        <AddCarButton />
      </div>
      <CollectionGrid vehicles={data} />
    </div>
  );
}
