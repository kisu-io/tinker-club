"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { SubmitButton } from "@/components/SubmitButton";
import { PlusIcon } from "@/components/icons";
import { createVehicle } from "./actions";

export function AddCarButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-accent">
        Add Car <PlusIcon />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add a car">
        <form action={createVehicle} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Make*</label>
              <input name="make" className="input" placeholder="Volkswagen" required />
            </div>
            <div>
              <label className="label">Model*</label>
              <input name="model" className="input" placeholder="Scirocco" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Year*</label>
              <input name="year" type="number" className="input" placeholder="2010" required />
            </div>
            <div>
              <label className="label">Mileage (km)</label>
              <input name="mileageKm" type="number" className="input" placeholder="0" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cylinders</label>
              <input name="cylinders" type="number" className="input" placeholder="4" />
            </div>
            <div>
              <label className="label">Performance (kW)</label>
              <input name="performanceKw" type="number" className="input" placeholder="118" />
            </div>
          </div>
          <div>
            <label className="label">Image URL (optional)</label>
            <input name="imageUrl" className="input" placeholder="https://…" />
          </div>
          <SubmitButton pendingText="Adding…">Add Car</SubmitButton>
        </form>
      </Modal>
    </>
  );
}
