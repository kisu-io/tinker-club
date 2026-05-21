import { requireUser } from "@/lib/auth";
import { Vehicles } from "@/lib/repo";
import { AddCarButton } from "./AddCarButton";
import { CollectionGrid, VehicleCardData } from "./CollectionGrid";

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

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hi {user.name}</h1>
          <p className="text-sm text-ink-500">Here is your collection</p>
        </div>
        <AddCarButton />
      </div>
      <CollectionGrid vehicles={data} />
    </div>
  );
}
