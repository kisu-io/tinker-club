"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { VehicleImage } from "@/components/VehicleImage";

export type VehicleCardData = {
  id: string;
  year: number;
  make: string;
  model: string;
  imageUrl: string | null;
  visibility: string;
  sharedCount: number;
};

type VisFilter = "ALL" | "PRIVATE" | "CLUB" | "PUBLIC";
type Sort = "recent" | "year-desc" | "year-asc" | "az";

const VIS_CHIPS: { value: VisFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PRIVATE", label: "Private" },
  { value: "CLUB", label: "Shared" },
  { value: "PUBLIC", label: "Public" },
];

const DOT_COLOR: Record<string, string> = {
  PRIVATE: "bg-ink-300",
  CLUB: "bg-accent",
  PUBLIC: "bg-emerald-400",
};

function visLabel(v: VehicleCardData): string {
  if (v.visibility === "CLUB") {
    return `Shared · ${v.sharedCount}`;
  }
  return v.visibility[0] + v.visibility.slice(1).toLowerCase();
}

export function CollectionGrid({ vehicles }: { vehicles: VehicleCardData[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [vis, setVis] = useState<VisFilter>("ALL");

  const filtered = useMemo(() => {
    let list = vehicles.filter((v) =>
      `${v.year} ${v.make} ${v.model}`.toLowerCase().includes(q.toLowerCase()),
    );
    if (vis !== "ALL") list = list.filter((v) => v.visibility === vis);
    switch (sort) {
      case "year-desc":
        list = [...list].sort((a, b) => b.year - a.year);
        break;
      case "year-asc":
        list = [...list].sort((a, b) => a.year - b.year);
        break;
      case "az":
        list = [...list].sort((a, b) =>
          `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`),
        );
        break;
    }
    return list;
  }, [vehicles, q, sort, vis]);

  // Featured layout only earns its keep when there's enough body grid to
  // balance it. With 1 car: one card spans wide. With 2: equal pair. With
  // 3+: featured + 3-col grid.
  const useFeatured = filtered.length === 1 || filtered.length >= 3;
  const featured = useFeatured ? filtered[0] : undefined;
  const rest = useFeatured ? filtered.slice(1) : filtered;

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 md:max-w-xs">
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your garage"
            aria-label="Search vehicles"
            className="w-full border-0 border-b border-ink-200 bg-transparent py-2 pl-6 pr-2 text-sm outline-none placeholder:text-ink-400 focus:border-ink-900"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-ink-100">
            {VIS_CHIPS.map((c) => (
              <button
                key={c.value}
                onClick={() => setVis(c.value)}
                aria-pressed={vis === c.value}
                className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  vis === c.value
                    ? "bg-ink-900 text-white"
                    : "text-ink-600 hover:bg-ink-50"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor="sort-select">
            Sort
          </label>
          <select
            id="sort-select"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="cursor-pointer rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 outline-none focus:border-ink-400"
          >
            <option value="recent">Recent</option>
            <option value="year-desc">Year ↓</option>
            <option value="year-asc">Year ↑</option>
            <option value="az">A–Z</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          {featured && <FeaturedCard vehicle={featured} />}
          {rest.length > 0 && (
            <div
              className={`grid grid-cols-1 gap-6 sm:grid-cols-2 ${
                rest.length >= 3 ? "lg:grid-cols-3" : ""
              }`}
            >
              {rest.map((v, i) => (
                <VehicleCard
                  key={v.id}
                  vehicle={v}
                  delayMs={(featured ? i + 1 : i) * 40}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FeaturedCard({ vehicle }: { vehicle: VehicleCardData }) {
  return (
    <Link
      href={`/dashboard/collection/${vehicle.id}/profile`}
      className="group block animate-rise"
      style={{ animationDelay: "0ms" }}
    >
      <div className="relative overflow-hidden rounded-[20px] shadow-card transition-shadow duration-200 group-hover:shadow-lift">
        <div className="aspect-[16/9] w-full overflow-hidden bg-ink-100 md:aspect-[21/9]">
          <VehicleImage
            src={vehicle.imageUrl}
            alt={`${vehicle.make} ${vehicle.model}`}
            className="h-full w-full transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5 text-white md:p-8">
          <div>
            <p className="eyebrow text-white/70">{vehicle.year} · Featured</p>
            <p className="font-display mt-1 text-2xl font-semibold tracking-tight md:text-4xl">
              {vehicle.make}{" "}
              <span className="italic font-medium">{vehicle.model}</span>
            </p>
          </div>
          <VisibilityBadge vehicle={vehicle} dark />
        </div>
      </div>
    </Link>
  );
}

function VehicleCard({
  vehicle,
  delayMs,
}: {
  vehicle: VehicleCardData;
  delayMs: number;
}) {
  return (
    <Link
      href={`/dashboard/collection/${vehicle.id}/profile`}
      className="group block animate-rise"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="relative overflow-hidden rounded-[20px] shadow-card transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lift">
        <div className="aspect-[4/3] w-full overflow-hidden bg-ink-100">
          <VehicleImage
            src={vehicle.imageUrl}
            alt={`${vehicle.make} ${vehicle.model}`}
            className="h-full w-full transition-transform duration-600 ease-out group-hover:scale-[1.04]"
          />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4 text-white">
          <div>
            <p className="text-[11px] uppercase tracking-eyebrow text-white/70">
              {vehicle.year}
            </p>
            <p className="font-display mt-0.5 text-lg font-semibold leading-tight">
              {vehicle.make}{" "}
              <span className="italic font-medium">{vehicle.model}</span>
            </p>
          </div>
          <VisibilityBadge vehicle={vehicle} dark />
        </div>
      </div>
    </Link>
  );
}

function VisibilityBadge({
  vehicle,
  dark = false,
}: {
  vehicle: VehicleCardData;
  dark?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
        dark
          ? "bg-white/15 text-white backdrop-blur-sm"
          : "bg-ink-100 text-ink-700"
      }`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${DOT_COLOR[vehicle.visibility] ?? "bg-ink-300"}`}
      />
      {visLabel(vehicle)}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto mt-12 max-w-md text-center">
      <h2 className="h-display text-4xl">Your garage is empty.</h2>
      <p className="mt-3 text-sm text-ink-600">
        Every car has a story. Add the first one and start logging service, drives,
        and the moments that make it yours.
      </p>
    </div>
  );
}
