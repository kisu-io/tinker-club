import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Vehicles } from "@/lib/repo";
import { CarHeader } from "./CarHeader";

export default async function VehicleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const user = await requireUser();
  const vehicle = await Vehicles.forOwner(params.id, user.id);
  if (!vehicle) notFound();

  return (
    <div>
      <CarHeader
        id={vehicle.id}
        title={`${vehicle.year} ${vehicle.make} ${vehicle.model}`.toUpperCase()}
        visibility={vehicle.visibility}
      />
      <div className="mt-4">{children}</div>
    </div>
  );
}
