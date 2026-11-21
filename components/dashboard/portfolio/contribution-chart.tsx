"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, ChartTooltip, GRID, Panel, shortDate } from "@/components/analytics/chart-kit";
import { SourceChip } from "@/components/analytics/parts";
import { formatCompact, formatPercent, formatUsd } from "@/lib/client/format";
import type { PortfolioMetric, PortfolioResult } from "@/lib/dashboard/portfolio-types";
import { cn } from "@/lib/utils";
import { appColor, METRICS, metricValue, seriesTotal } from "./portfolio-format";

export default function ContributionChart({ data }: { data: PortfolioResult }) {
  const [metric, setMetric] = useState<PortfolioMetric>(() => METRICS.find((m) => data.apps.some((a) => a.series[m.key].some((v) => v != null)))?.key ?? "downloads");
  const [releases, setReleases] = useState(true);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const meta = METRICS.find((m) => m.key === metric) ?? METRICS[0];
  const week = data.dates.length > 45;
  const rows = useMemo(() => {
    const out: Record<string, number | string | null>[] = [];
    data.dates.forEach((date, i) => {
      const bucket = week ? Math.floor(i / 7) : i;
      const row = out[bucket] ?? (out[bucket] = { date });
      for (const app of data.apps) {
        const v = app.series[metric][i];
        if (v == null) continue;
        row[app.key] = Math.round((Number(row[app.key] ?? 0) + (meta.daily && week ? v / 7 : v)) * 100) / 100;
      }
    });
    return out;
  }, [data, metric, week, meta.daily]);
  const totals = data.apps.map((app) => seriesTotal(app, metric));
  const sum = totals.reduce<number>((s, n) => s + (n ?? 0), 0);
  const shown = data.apps.filter((a) => !hidden.has(a.key) && a.series[metric].some((v) => v != null));
  const markers = releases ? data.apps.flatMap((app, i) => (hidden.has(app.key) ? [] : app.versions.map((v) => ({ ...v, app: app.name, color: appColor(i) })))) : [];
  const dateOf = (iso: string) => (week ? (rows.find((r, i) => String(r.date) <= iso && (i === rows.length - 1 || String(rows[i + 1].date) > iso))?.date as string | undefined) : iso);
  const interval = rows.length > 45 ? 6 : rows.length > 14 ? 3 : 0;
  const tick = (v: number) => (metric === "revenue" ? formatUsd(v) : meta.daily && v < 10 ? String(Math.round(v * 100) / 100) : formatCompact(v));

  return (
    <Panel
      title="Contribution by app"
      description={`${meta.label} per ${week ? "week" : "day"}, stacked by app, last ${data.days} days. ${meta.hint}.`}
      actions={
        <label className="caption-style text-soft flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={releases} onChange={(e) => setReleases(e.target.checked)} className="accent-(--trend)" />
          Release markers
        </label>
      }
    >
      <div role="radiogroup" aria-label="Metric" className="flex flex-wrap items-center gap-1.5">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            role="radio"
            aria-checked={metric === m.key}
            title={m.hint}
            onClick={() => setMetric(m.key)}
            className={cn(
              "caption-style focus-visible:ring-ring/60 border-border flex h-[26px] cursor-pointer items-center gap-1.5 rounded-full border px-2.5 transition-colors duration-150 outline-none focus-visible:ring-2",
              metric === m.key ? "bg-secondary text-foreground" : "text-subtle hover:text-soft",
            )}
          >
            {m.label}
            <SourceChip source={m.source} />
          </button>
        ))}
      </div>
      {shown.length ? (
        <div className="h-[280px]" role="img" aria-label={`${meta.label} by app over the last ${data.days} days`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 16, right: 4, bottom: 0, left: -8 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS_TICK} axisLine={false} tickLine={false} interval={interval} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} tickFormatter={tick} />
              {markers.map((v) => {
                const x = dateOf(v.date);
                return x ? <ReferenceLine key={`${v.app}-${v.version}`} x={x} stroke={v.color} strokeDasharray="3 3" label={markers.length <= 3 ? { value: `${v.app} v${v.version}`, position: "insideTopRight", fill: "var(--subtle)", fontSize: 10 } : undefined} /> : null;
              })}
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                content={(props) => (
                  <ChartTooltip
                    {...props}
                    rows={(pt) => [
                      ...data.apps.flatMap((app, i) => (hidden.has(app.key) || pt[app.key] == null ? [] : [{ label: app.name, value: metricValue(metric, Number(pt[app.key])), color: appColor(i) }])),
                      { label: meta.daily ? "All apps / day" : "All apps", value: metricValue(metric, shown.reduce((s, a) => s + (Number(pt[a.key]) || 0), 0)) },
                    ]}
                  />
                )}
              />
              {data.apps.map((app, i) =>
                hidden.has(app.key) ? null : <Bar key={app.key} dataKey={app.key} stackId="apps" fill={appColor(i)} maxBarSize={28} isAnimationActive={false} />,
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-subtle flex h-[280px] items-center justify-center text-center">No app reports {meta.label.toLowerCase()} for this period.</p>
      )}
      <ul aria-label="Apps" className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
        {data.apps.map((app, i) => {
          const total = totals[i];
          const off = hidden.has(app.key);
          return (
            <li key={app.key}>
              <button
                type="button"
                aria-pressed={!off}
                disabled={total == null}
                title={total == null ? `${app.name} does not report this metric` : off ? `Show ${app.name}` : `Hide ${app.name}`}
                onClick={() =>
                  setHidden((prev) => {
                    const next = new Set(prev);
                    if (next.has(app.key)) next.delete(app.key);
                    else next.add(app.key);
                    return next;
                  })
                }
                className={cn(
                  "border-border focus-visible:ring-ring/60 flex w-full cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-left outline-none hover:bg-white/4 focus-visible:ring-2 disabled:cursor-default disabled:hover:bg-transparent",
                  off && "opacity-50",
                )}
              >
                <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: total == null ? "transparent" : appColor(i), boxShadow: `inset 0 0 0 1px ${appColor(i)}` }} />
                <span className="min-w-0 flex-1 truncate text-[13px]">{app.name}</span>
                {total == null ? (
                  <span className="caption-style text-subtle shrink-0">not connected</span>
                ) : (
                  <span className="caption-style shrink-0 tabular-nums">
                    {metricValue(metric, total)}
                    {meta.daily ? "/day" : ""} <span className="text-subtle">· {formatPercent(sum ? total / sum : null, 0)}</span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
