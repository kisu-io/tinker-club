"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { SubmitButton } from "@/components/SubmitButton";
import type { Vehicle } from "@/lib/types";
import { updateVehicleSpecs } from "../../actions";

export function EditProfileButton({ vehicle }: { vehicle: Vehicle }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function action(fd: FormData) {
    await updateVehicleSpecs(vehicle.id, fd);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-lg border border-ink-200 p-2 text-ink-600 hover:bg-ink-50" aria-label="Edit specs">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
        </svg>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Edit vehicle">
        <form action={action} className="space-y-4">
          <div>
            <label className="label">Model</label>
            <input name="model" defaultValue={vehicle.model} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cylinders</label>
              <input name="cylinders" type="number" defaultValue={vehicle.cylinders ?? ""} className="input" />
            </div>
            <div>
              <label className="label">Performance (kW)</label>
              <input name="performanceKw" type="number" defaultValue={vehicle.performanceKw ?? ""} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Mileage (km)</label>
              <input name="mileageKm" type="number" defaultValue={vehicle.mileageKm} className="input" />
            </div>
            <div>
              <label className="label">Color</label>
              <input name="color" defaultValue={vehicle.color ?? ""} className="input" />
            </div>
          </div>
          <div>
            <label className="label">VIN</label>
            <input name="vin" defaultValue={vehicle.vin ?? ""} className="input" />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea name="description" defaultValue={vehicle.description ?? ""} className="input min-h-[80px]" />
          </div>
          <input type="hidden" name="imageUrl" value={vehicle.imageUrl ?? ""} />
          <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
        </form>
      </Modal>
    </>
  );
}

export function ChangeImageButton({ vehicle }: { vehicle: Vehicle }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function action(fd: FormData) {
    // Reuse the specs update action, preserving existing fields.
    fd.set("model", vehicle.model);
    fd.set("cylinders", String(vehicle.cylinders ?? ""));
    fd.set("performanceKw", String(vehicle.performanceKw ?? ""));
    fd.set("mileageKm", String(vehicle.mileageKm));
    fd.set("color", vehicle.color ?? "");
    fd.set("vin", vehicle.vin ?? "");
    fd.set("description", vehicle.description ?? "");
    await updateVehicleSpecs(vehicle.id, fd);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-white/85 p-4 backdrop-blur">
        <button onClick={() => setOpen(true)} className="btn-primary text-xs">Change Image</button>
        <span className="text-xs text-ink-400">or</span>
        <button
          onClick={() => alert("AI image enhancement is a demo placeholder in this build. Wire it to your image model of choice.")}
          className="btn inline-flex items-center gap-1.5 bg-accent text-xs text-white hover:opacity-90"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 3v4M3 5h4M6 17v4M4 19h4M13 3l2.5 6.5L22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5L13 3z" />
          </svg>
          Enhance Image
        </button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Change image">
        <form action={action} className="space-y-4">
          <div>
            <label className="label">Image URL</label>
            <input name="imageUrl" defaultValue={vehicle.imageUrl ?? ""} placeholder="https://…" className="input" />
            <p className="mt-1 text-xs text-ink-400">Paste a link to a photo of your car.</p>
          </div>
          <SubmitButton pendingText="Saving…">Update image</SubmitButton>
        </form>
      </Modal>
    </>
  );
}
