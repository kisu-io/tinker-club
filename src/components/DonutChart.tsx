import { CATEGORY_COLORS } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { EngineIcon } from "./icons";

export function DonutChart({
  data,
  currency = "EUR",
}: {
  data: { category: string; total: number }[];
  currency?: string;
}) {
  const total = data.reduce((s, d) => s + d.total, 0);
  const size = 180;
  const stroke = 26;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  const segments = total > 0
    ? data.map((d) => {
        const frac = d.total / total;
        const seg = { ...d, frac, dash: frac * circ, offset };
        offset += frac * circ;
        return seg;
      })
    : [];

  return (
    <div className="flex items-center gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={cx} cy={cx} r={r} fill="none" stroke="#eef2f7" strokeWidth={stroke} />
          {segments.map((s) => (
            <circle
              key={s.category}
              cx={cx}
              cy={cx}
              r={r}
              fill="none"
              stroke={CATEGORY_COLORS[s.category] ?? "#94a3b8"}
              strokeWidth={stroke}
              strokeDasharray={`${s.dash} ${circ - s.dash}`}
              strokeDashoffset={-s.offset}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-sky-600">
            <EngineIcon />
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-2 text-sm">
        {data.length === 0 && <p className="text-ink-400">No expenses yet.</p>}
        {data.map((d) => (
          <div key={d.category} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: CATEGORY_COLORS[d.category] ?? "#94a3b8" }} />
              <span className="capitalize text-ink-600">{d.category.toLowerCase()}</span>
            </span>
            <span className="text-right">
              <span className="font-semibold text-ink-900">{formatCurrency(d.total, currency)}</span>
              <span className="ml-2 text-xs text-ink-400">{total ? ((d.total / total) * 100).toFixed(2) : "0.00"}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
