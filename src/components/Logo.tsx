export function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-900 text-[11px] font-semibold italic text-white">
        Mc
      </span>
      <span className={`text-lg font-medium ${light ? "text-white" : "text-ink-900"}`}>
        mycollection
      </span>
    </div>
  );
}
