"use client";

import { useState } from "react";
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, ChartTooltip, GRID, Panel, shortDate } from "@/components/analytics/chart-kit";
import { approxInstalls } from "@/components/trends/trends-format";
import { formatCompact } from "@/lib/client/format";
import type { TrafficPoint, TrafficResult } from "@/lib/traffic/types";
import { cn } from "@/lib/utils";
import Reconcile from "./reconcile";
import { SERIES_COLOR } from "./traffic-format";

type SeriesKey = keyof typeof SERIES_COLOR;

const SERIES: { key: SeriesKey; label: string; source: string; hint: string; dashed?: boolean; right?: boolean; on: boolean }[] = [
  { key: "downloads", label: "First-time downloads", source: "Apple", hint: "First-time downloads per day, reported by Apple", on: true },
  { key: "firstOpens", label: "First opens", source: "PostHog", hint: "First-open events per day, counted by PostHog", on: true },
  { key: "estSearch", label: "Est. search installs", source: "Estimate", hint: "Installs per day the rankings model expects from your tracked keywords", dashed: true, on: true },
  { key: "searchDownloads", label: "Search downloads", source: "Apple", hint: "First-time downloads Apple attributes to App Store search. The real number behind the estimate.", on: false },
  { key: "impressions", label: "Impressions", source: "Apple", hint: "Impressions per day, on the right axis", right: true, on: false },
];

function value(key: SeriesKey, v: unknown) {
  if (v == null) return "—";
  return key === "estSearch" ? approxInstalls(Number(v)) : formatCompact(Number(v));
}

export default function OverlayChart({ data }: { data: TrafficResult }) {
  const [shown, setShown] = useState<Record<SeriesKey, boolean>>(() => Object.fromEntries(SERIES.map((s) => [s.key, s.on])) as Record<SeriesKey, boolean>);
  const available = (key: SeriesKey) => data.daily.some((p) => p[key] != null);
  const active = SERIES.filter((s) => shown[s.key] && available(s.key));
  const versions = new Map<string, string[]>();
  for (const v of data.versions) versions.set(v.date, [...(versions.get(v.date) ?? []), v.version]);
  const interval = data.daily.length > 90 ? 13 : data.daily.length > 30 ? 6 : data.daily.length > 10 ? 3 : 0;

  return (
    <Panel
      title="Downloads, first opens and search estimate"
      description={`Per day, last ${data.days} days${data.country === "all" ? "" : ` · ${data.country.toUpperCase()}`}. Same axis, so the gap between lines is the gap between sources.`}
    >
      <div role="group" aria-label="Series" className="flex flex-wrap items-center gap-1.5">
        {SERIES.map((s) => {
          const ok = available(s.key);
          return (
            <button
              key={s.key}
              type="button"
              disabled={!ok}
              aria-pressed={ok && shown[s.key]}
              title={ok ? s.hint : `${s.hint}. No data for this period.`}
              onClick={() => setShown((prev) => ({ ...prev, [s.key]: !prev[s.key] }))}
              className={cn(
                "caption-style focus-visible:ring-ring/60 border-border flex h-[26px] cursor-pointer items-center gap-1.5 rounded-full border px-2.5 transition-colors duration-150 outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40",
                ok && shown[s.key] ? "bg-secondary text-foreground" : "text-subtle hover:text-soft",
              )}
            >
              <span aria-hidden className="size-2 rounded-[2px]" style={{ background: ok && shown[s.key] ? SERIES_COLOR[s.key] : "transparent", boxShadow: `inset 0 0 0 1px ${SERIES_COLOR[s.key]}` }} />
              {s.label}
              <span className="text-subtle">{s.source}</span>
            </button>
          );
        })}
      </div>
      <div className="h-[280px]" role="img" aria-label={`Daily ${active.map((s) => s.label).join(", ")} over the last ${data.days} days`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data.daily} margin={{ top: 16, right: 4, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS_TICK} axisLine={false} tickLine={false} interval={interval} />
            <YAxis yAxisId="left" tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => formatCompact(v)} />
            <YAxis yAxisId="right" orientation="right" tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => formatCompact(v)} hide={!active.some((s) => s.right)} />
            {data.versions.map((v) => (
              <ReferenceLine
                key={v.version}
                yAxisId="left"
                x={v.date}
                stroke="var(--faint)"
                strokeDasharray="3 3"
                label={data.versions.length <= 6 ? { value: `v${v.version}`, position: "insideTopRight", fill: "var(--subtle)", fontSize: 10 } : undefined}
              />
            ))}
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.2)" }}
              content={(props) => (
                <ChartTooltip
                  {...props}
                  rows={(pt) => {
                    const p = pt as unknown as TrafficPoint;
                    return [
                      ...active.map((s) => ({ label: `${s.label} · ${s.source}`, value: value(s.key, p[s.key]), color: SERIES_COLOR[s.key] })),
                      ...(versions.has(p.date) ? [{ label: "Released", value: (versions.get(p.date) ?? []).map((v) => `v${v}`).join(", ") }] : []),
                    ];
                  }}
                />
              )}
            />
            {active.map((s) => (
              <Line
                key={s.key}
                yAxisId={s.right ? "right" : "left"}
                type="monotone"
                dataKey={s.key}
                stroke={SERIES_COLOR[s.key]}
                strokeWidth={s.right ? 1.5 : 2}
                strokeDasharray={s.dashed ? "5 4" : undefined}
                dot={data.daily.filter((p) => p[s.key] != null).length < 2 ? { r: 3, fill: SERIES_COLOR[s.key], strokeWidth: 0 } : false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {data.versions.length > 0 && <p className="caption-style text-subtle">Releases: {data.versions.map((v) => `v${v.version} (${shortDate(v.date)})`).join(" · ")}</p>}
      <Reconcile items={data.reconcile} />
    </Panel>
  );
}
