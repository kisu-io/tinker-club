"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronLeft } from "@/components/icons";
import { setVisibility } from "../actions";
import type { Visibility } from "@/lib/types";

const TABS = ["profile", "gallery", "documents", "expenses", "timeline", "share"] as const;

const visMeta: Record<Visibility, { label: string; dot: string }> = {
  PRIVATE: { label: "Private", dot: "bg-ink-400" },
  CLUB: { label: "Shared", dot: "bg-violet-500" },
  PUBLIC: { label: "Public", dot: "bg-emerald-500" },
};

export function CarHeader({ id, title, visibility }: { id: string; title: string; visibility: Visibility }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const base = `/dashboard/collection/${id}`;
  const current = TABS.find((t) => pathname.endsWith(`/${t}`)) ?? "profile";

  function change(v: Visibility) {
    setOpen(false);
    start(async () => {
      await setVisibility(id, v);
      router.refresh();
    });
  }

  const meta = visMeta[visibility];

  return (
    <div className="border-b border-ink-100 pb-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/dashboard/collection" className="rounded-lg p-1 text-ink-500 hover:bg-ink-50">
            <ChevronLeft />
          </Link>
          <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">{title}</h1>
          <div className="relative">
            <button
              onClick={() => setOpen((o) => !o)}
              className="pill bg-ink-50 text-ink-700 hover:bg-ink-100"
              disabled={pending}
            >
              <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
              {meta.label}
            </button>
            {open && (
              <div className="absolute left-0 z-20 mt-1 w-44 rounded-xl border border-ink-100 bg-white p-1 shadow-card">
                {(Object.keys(visMeta) as Visibility[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => change(v)}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-ink-50"
                  >
                    <span className={`h-2 w-2 rounded-full ${visMeta[v].dot}`} />
                    {visMeta[v].label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <nav className="no-scrollbar -mb-3 mt-3 flex gap-5 overflow-x-auto text-sm">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`${base}/${t}`}
            className={`whitespace-nowrap pb-2 capitalize ${
              current === t
                ? "border-b-2 border-ink-900 font-semibold text-ink-900"
                : "border-b-2 border-transparent text-ink-500 hover:text-ink-800"
            }`}
          >
            {t}
          </Link>
        ))}
      </nav>
    </div>
  );
}
