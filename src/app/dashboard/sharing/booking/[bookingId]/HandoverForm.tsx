"use client";

import { useRouter } from "next/navigation";
import { SubmitButton } from "@/components/SubmitButton";
import { saveHandover } from "../../actions";

export function HandoverForm({
  bookingId,
  phase,
  checklist,
  done,
}: {
  bookingId: string;
  phase: "pickup" | "return";
  checklist: string[];
  done: boolean;
}) {
  const router = useRouter();
  async function action(fd: FormData) {
    await saveHandover(bookingId, phase, fd);
    router.refresh();
  }

  return (
    <form action={action} className="space-y-4">
      {phase === "pickup" && (
        <div className="space-y-2">
          {checklist.map((item) => (
            <label key={item} className="flex items-start gap-2 text-sm text-ink-700">
              <input type="checkbox" name="checklist" value={item} className="mt-0.5" defaultChecked={done} />
              {item}
            </label>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Mileage (km)</label>
          <input name="mileageKm" type="number" className="input" placeholder="e.g. 84210" />
        </div>
        <div>
          <label className="label">Fuel / charge (%)</label>
          <input name="fuelPct" type="number" min={0} max={100} className="input" placeholder="e.g. 80" />
        </div>
      </div>
      {phase === "return" && (
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" name="damage" /> Damage to report
        </label>
      )}
      <div>
        <label className="label">Notes</label>
        <textarea name="notes" className="input min-h-[70px]" placeholder="Condition, observations…" />
      </div>
      <SubmitButton className="btn-primary" pendingText="Saving…">
        {phase === "pickup" ? "Confirm pickup" : "Confirm return"}
      </SubmitButton>
    </form>
  );
}
