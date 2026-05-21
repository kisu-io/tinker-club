"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { VehicleImage } from "@/components/VehicleImage";
import { ChevronRight } from "@/components/icons";

export type VehicleCardData = {
  id: string;
  year: number;
  make: string;
  model: string;
  imageUrl: string | null;
  visibility: string;
  sharedCount: number;
};

const visStyle: Record<string, string> = {
  PRIVATE: "bg-ink-100 text-ink-600",
  CLUB: "bg-violet-100 text-violet-700",
  PUBLIC: "bg-emerald-100 text-emerald-700",
};

export function CollectionGrid({ vehicles }: { vehicles: VehicleCardData[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"recent" | "year-desc" | "year-asc" | "az">("recent");
  const [vis, setVis] = useState<"ALL" | "PRIVATE" | "CLUB" | "PUBLIC">("ALL");

  const filtered = useMemo(() => {
    let list = vehicles.filter((v) =>
      `${v.year} ${v.make} ${v.model}`.toLowerCase().includes(q.toLowerCase())
    );
    if (vis !== "ALL") list = list.filter((v) => v.visibility === vis);
    switch (sort) {
      case "year-desc": list = [...list].sort((a, b) => b.year - a.year); break;
      case "year-asc": list = [...list].sort((a, b) => a.year - b.year); break;
      case "az": list = [...list].sort((a, b) => `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`)); break;
    }
    return list;
  }, [vehicles, q, sort, vis]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="input pl-9"
          />
        </div>
        <select value={vis} onChange={(e) => setVis(e.target.value as any)} className="input w-auto">
          <option value="ALL">All</option>
          <option value="PRIVATE">Private</option>
          <option value="CLUB">Shared</option>
          <option value="PUBLIC">Public</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="input w-auto">
          <option value="recent">Sort by</option>
          <option value="year-desc">Year ↓</option>
          <option value="year-asc">Year ↑</option>
          <option value="az">A–Z</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-10 text-center text-ink-500">
          No cars yet. Use <span className="font-medium text-ink-800">Add Car</span> to start your collection.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v) => (
            <Link key={v.id} href={`/dashboard/collection/${v.id}/profile`} className="card group overflow-hidden transition hover:shadow-lg">
              <VehicleImage src={v.imageUrl} alt={`${v.make} ${v.model}`} className="h-44 w-full" />
              <div className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs text-ink-400">{v.year}</p>
                  <p className="font-medium text-ink-900">{v.make} {v.model}</p>
                  <span className={`pill mt-2 ${visStyle[v.visibility]}`}>
                    {v.visibility === "CLUB" ? `Shared · ${v.sharedCount}` : v.visibility[0] + v.visibility.slice(1).toLowerCase()}
                  </span>
                </div>
                <ChevronRight className="h-5 w-5 text-ink-300 group-hover:text-ink-600" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
