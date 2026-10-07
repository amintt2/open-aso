import { cn } from "@/lib/utils";
import type { AdsDashboard, Metrics } from "@/lib/apple-ads/types";
import { count, money, moneyCompact, multiple, pct } from "./format";

type Tile = { label: string; value: string; delta?: number | null; lowerIsBetter?: boolean; neutral?: boolean; hint?: string };

function delta(cur: number | null, prev: number | null | undefined) {
  if (cur == null || prev == null || prev === 0) return null;
  return (cur - prev) / prev;
}

function metricTiles(t: Metrics, p: Metrics | null, currency: string): Tile[] {
  return [
    { label: "Spend", value: moneyCompact(t.spend, currency), delta: delta(t.spend, p?.spend), neutral: true },
    { label: "Impressions", value: count(t.impressions), delta: delta(t.impressions, p?.impressions) },
    { label: "Taps", value: count(t.taps), delta: delta(t.taps, p?.taps) },
    { label: "Installs", value: count(t.installs), delta: delta(t.installs, p?.installs), hint: "Tap-through" },
    { label: "TTR", value: pct(t.ttr), delta: delta(t.ttr, p?.ttr) },
    { label: "CR", value: pct(t.cr), delta: delta(t.cr, p?.cr) },
    { label: "Avg CPT", value: money(t.cpt, currency), delta: delta(t.cpt, p?.cpt), lowerIsBetter: true },
    { label: "Avg CPA", value: money(t.cpa, currency), delta: delta(t.cpa, p?.cpa), lowerIsBetter: true },
  ];
}

export default function KpiTiles({ data }: { data: AdsDashboard }) {
  const tiles = metricTiles(data.totals, data.previousTotals, data.currency);
  if (data.attribution) {
    tiles.push({ label: "Revenue", value: moneyCompact(data.attribution.revenue, "USD"), hint: `${count(data.attribution.installs)} attributed installs` });
    tiles.push({ label: "ROAS", value: multiple(data.attribution.roas), hint: `RPI ${money(data.attribution.rpi, "USD")}` });
  }
  return (
    <div className={cn("border-border bg-border grid grid-cols-2 gap-px overflow-hidden rounded-xl border sm:grid-cols-4", tiles.length > 8 ? "xl:grid-cols-5 2xl:grid-cols-10" : "xl:grid-cols-8")}>
      {tiles.map((t) => {
        const good = t.delta == null || t.neutral ? null : t.lowerIsBetter ? t.delta < 0 : t.delta > 0;
        return (
          <div key={t.label} className="bg-card flex min-w-0 flex-col gap-2 p-3.5">
            <span className="caption-style text-subtle">{t.label}</span>
            <span className="truncate text-[18px] leading-none font-medium tabular-nums">{t.value}</span>
            <span className="caption-style flex min-h-3 items-center gap-1.5">
              {t.delta != null && (
                <span className={cn("tabular-nums", good === null ? "text-soft" : good ? "text-trend" : "text-danger")}>
                  {t.delta > 0 ? "▲" : t.delta < 0 ? "▼" : ""}
                  {Math.abs(t.delta * 100).toFixed(0)}%
                </span>
              )}
              {t.hint && <span className="text-subtle truncate">{t.hint}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
