import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Vehicles, Gallery } from "@/lib/repo";
import { VehicleImage } from "@/components/VehicleImage";
import { DeleteButton } from "@/components/DeleteButton";
import { AddGalleryButton } from "./AddGalleryButton";
import { deleteGalleryImage } from "../detail-actions";

export default async function GalleryPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const v = Vehicles.forOwner(params.id, user.id);
  if (!v) notFound();

  const images = Gallery.forVehicle(v.id);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink-500">Gallery</h2>
        <AddGalleryButton vehicleId={v.id} />
      </div>

      {images.length === 0 ? (
        <div className="card p-10 text-center text-sm text-ink-400">
          No photos yet. Add images to build this car&apos;s gallery.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img) => (
            <div key={img.id} className="group relative overflow-hidden rounded-xl">
              <VehicleImage src={img.url} alt={img.caption ?? "Photo"} className="aspect-square w-full" />
              <div className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100">
                <DeleteButton
                  action={deleteGalleryImage.bind(null, v.id, img.id)}
                  confirm="Delete this photo?"
                  className="rounded-lg bg-white/90 p-1.5 text-red-500 hover:bg-white"
                />
              </div>
              {img.caption && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-900/70 to-transparent p-2 text-xs text-white">
                  {img.caption}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
