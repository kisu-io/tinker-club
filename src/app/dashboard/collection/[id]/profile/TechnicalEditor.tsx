"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { SubmitButton } from "@/components/SubmitButton";
import type { Vehicle } from "@/lib/types";
import { updateTechnical, updateFacts } from "../../actions";

function PencilButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-lg border border-ink-200 p-2 text-ink-600 hover:bg-ink-50" aria-label="Edit">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
    </button>
  );
}

export function EditTechnicalButton({ vehicle }: { vehicle: Vehicle }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function action(fd: FormData) {
    await updateTechnical(vehicle.id, fd);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <PencilButton onClick={() => setOpen(true)} />
      <Modal open={open} onClose={() => setOpen(false)} title="Technical information">
        <form action={action} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Vehicle type</label>
              <select name="vehicleType" className="input" defaultValue={vehicle.vehicleType ?? ""}>
                <option value="">–</option>
                <option>STREETCAR</option><option>RACECAR</option><option>MOTORCYCLE</option><option>OTHER</option>
              </select>
            </div>
            <div>
              <label className="label">Body style</label>
              <select name="bodyStyle" className="input" defaultValue={vehicle.bodyStyle ?? ""}>
                <option value="">–</option>
                <option>HATCHBACK</option><option>COUPE</option><option>SEDAN</option><option>CONVERTIBLE</option>
                <option>SUV</option><option>WAGON</option><option>PICKUP</option><option>OTHER</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Previous owners</label>
              <input name="previousOwners" type="number" min={0} className="input" defaultValue={vehicle.previousOwners ?? ""} />
            </div>
            <div>
              <label className="label">Units produced</label>
              <input name="unitsProduced" type="number" min={0} className="input" defaultValue={vehicle.unitsProduced ?? ""} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">VIN number</label>
              <input name="vin" className="input" defaultValue={vehicle.vin ?? ""} />
            </div>
            <div>
              <label className="label">Transmission number</label>
              <input name="transmissionNumber" className="input" defaultValue={vehicle.transmissionNumber ?? ""} />
            </div>
          </div>
          <div>
            <label className="label">Location</label>
            <input name="location" className="input" defaultValue={vehicle.location ?? ""} placeholder="City, Country" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Gearbox</label>
              <select name="gearbox" className="input" defaultValue={vehicle.gearbox ?? ""}>
                <option value="">–</option>
                <option>MANUAL</option><option>AUTOMATIC</option><option>SEMI-AUTOMATIC</option>
              </select>
            </div>
            <div>
              <label className="label">Drive type</label>
              <select name="driveType" className="input" defaultValue={vehicle.driveType ?? ""}>
                <option value="">–</option>
                <option>FRONT WHEEL DRIVE (FWD)</option>
                <option>REAR WHEEL DRIVE (RWD)</option>
                <option>ALL WHEEL DRIVE (AWD)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Driver&apos;s side</label>
              <select name="driversSide" className="input" defaultValue={vehicle.driversSide ?? ""}>
                <option value="">–</option>
                <option>LEFT-HAND DRIVE (LHD)</option>
                <option>RIGHT-HAND DRIVE (RHD)</option>
              </select>
            </div>
            <label className="flex items-center gap-2 pt-7 text-sm text-ink-700">
              <input type="checkbox" name="matchingNumbers" defaultChecked={vehicle.matchingNumbers === 1} />
              Matching numbers
            </label>
          </div>
          <SubmitButton pendingText="Saving…">Save</SubmitButton>
        </form>
      </Modal>
    </>
  );
}

export function EditFactsButton({ vehicle }: { vehicle: Vehicle }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const facts: string[] = vehicle.keyFacts ? JSON.parse(vehicle.keyFacts) : [];

  async function action(fd: FormData) {
    await updateFacts(vehicle.id, fd);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <PencilButton onClick={() => setOpen(true)} />
      <Modal open={open} onClose={() => setOpen(false)} title="Key moments & facts">
        <form action={action} className="space-y-4">
          <div>
            <label className="label">Key facts (one per line)</label>
            <textarea name="keyFacts" className="input min-h-[140px]" defaultValue={facts.join("\n")} placeholder={"One fact per line…"} />
          </div>
          <div>
            <label className="label">Overview</label>
            <textarea name="overview" className="input min-h-[120px]" defaultValue={vehicle.overview ?? ""} placeholder="A short description of the model and its history." />
          </div>
          <SubmitButton pendingText="Saving…">Save</SubmitButton>
        </form>
      </Modal>
    </>
  );
}
