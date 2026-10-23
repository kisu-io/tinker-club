"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SubmitButton } from "@/components/SubmitButton";
import { addBlock, removeBlock } from "@/app/dashboard/sharing/actions";
import { RangeFields, wholeDay } from "@/app/dashboard/sharing/RangeFields";

export function AddBlockForm({ vehicleId }: { vehicleId: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const [range, setRange] = useState(wholeDay(today));
  const [msg, setMsg] = useState<Awaited<ReturnType<typeof addBlock>> | null>(null);
  const router = useRouter();

  async function action(fd: FormData) {
    const res = await addBlock(fd);
    setMsg(res);
    if ("ok" in res) router.refresh();
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <RangeFields value={range} min={today} onChange={(r) => { setMsg(null); setRange(r); }} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px] flex-1">
          <label className="label" htmlFor="reason">Reason (optional)</label>
          <input id="reason" name="reason" maxLength={120} className="input" placeholder="Own use, service, show…" />
        </div>
        <SubmitButton className="btn-primary" pendingText="Blocking…">Block dates</SubmitButton>
      </div>
      {msg && "error" in msg && (
        <p className="text-sm text-red-600">
          {msg.error}{" "}
          {msg.bookingId && <Link href={`/dashboard/sharing/booking/${msg.bookingId}`} className="underline">View booking</Link>}
        </p>
      )}
      {msg && "ok" in msg && <p className="text-sm text-emerald-600">Dates blocked.</p>}
    </form>
  );
}

export function RemoveBlockButton({ blockId }: { blockId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      disabled={pending}
      onClick={() => start(async () => { await removeBlock(blockId); router.refresh(); })}
      className="btn-ghost text-xs disabled:opacity-50"
    >
      Remove
    </button>
  );
}
