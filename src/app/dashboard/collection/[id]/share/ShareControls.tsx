"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SubmitButton } from "@/components/SubmitButton";
import { shareVehicle, unshareVehicle } from "@/app/dashboard/sharing/actions";

export function ShareForm({
  vehicleId,
  clubs,
}: {
  vehicleId: string;
  clubs: { id: string; name: string }[];
}) {
  const router = useRouter();

  async function action(fd: FormData) {
    await shareVehicle(fd);
    router.refresh();
  }

  if (clubs.length === 0) {
    return (
      <p className="text-sm text-ink-400">
        You can share this car once you&apos;ve joined or created a club in the Sharing tab.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <div className="min-w-[180px] flex-1">
        <label className="label">Share into club</label>
        <select name="clubId" className="input" required>
          {clubs.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 pb-2.5 text-sm text-ink-700">
        <input type="checkbox" name="requireApproval" defaultChecked /> Require my approval
      </label>
      <SubmitButton className="btn-primary" pendingText="Sharing…">Share</SubmitButton>
    </form>
  );
}

export function UnshareButton({ vehicleId, clubId }: { vehicleId: string; clubId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      disabled={pending}
      onClick={() => { if (confirm("Stop sharing into this club?")) start(async () => { await unshareVehicle(vehicleId, clubId); router.refresh(); }); }}
      className="btn-ghost text-xs disabled:opacity-50"
    >
      Unshare
    </button>
  );
}
