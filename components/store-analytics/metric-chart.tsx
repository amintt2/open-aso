"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, ChartTooltip, GRID, Legend, Panel, SERIES, shortDate } from "@/components/analytics/chart-kit";
import type { StorePoint } from "@/lib/asc/analytics/types";
import { formatCompact, formatPercent } from "@/lib/client/format";
import { byWeek } from "./format";
import { Segmented } from "./parts";

type Metric = "impressions" | "pageViews" | "downloads" | "conversion";
type Grain = "day" | "week";

const METRICS: { key: Metric; label: string }[] = [
  { key: "impressions", label: "Impressions" },
  { key: "pageViews", label: "Page views" },
  { key: "downloads", label: "Downloads" },
  { key: "conversion", label: "Conversion" },
];

const pct = (v: unknown) => formatPercent(typeof v === "number" ? v : null, 2);
const num = (v: unknown) => formatCompact(typeof v === "number" ? v : 0);

function Axes({ grain, count, percent }: { grain: Grain; count: number; percent?: boolean }) {
  return (
    <>
      <CartesianGrid vertical={false} stroke={GRID} />
      <XAxis
        dataKey="date"
        tickFormatter={shortDate}
        tick={AXIS_TICK}
        axisLine={false}
        tickLine={false}
        minTickGap={24}
        interval={grain === "week" || count <= 14 ? 0 : "preserveStartEnd"}
      />
      <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} allowDecimals={!!percent} tickFormatter={(v: number) => (percent ? `${(v * 100).toFixed(1)}%` : formatCompact(v))} />
    </>
  );
}

export default function MetricChart({ daily }: { daily: StorePoint[] }) {
  const [metric, setMetric] = useState<Metric>("downloads");
  const [grain, setGrain] = useState<Grain>("day");
  const points = useMemo(() => (grain === "week" ? byWeek(daily) : daily), [daily, grain]);
  const margin = { top: 4, right: 4, bottom: 0, left: -8 };
  const cursor = { fill: "rgba(255,255,255,0.04)" };

  let chart: React.ReactElement;
  let legend: { label: string; color: string }[];
  if (metric === "downloads") {
    legend = [
      { label: "First-time downloads", color: SERIES.blue },
      { label: "Redownloads", color: SERIES.aqua },
    ];
    chart = (
      <BarChart data={points} margin={margin}>
        <Axes grain={grain} count={points.length} />
        <Tooltip
          cursor={cursor}
          content={(p) => (
            <ChartTooltip
              {...p}
              rows={(pt) => [
                { label: "First-time", value: num(pt.firstDownloads), color: SERIES.blue },
                { label: "Redownloads", value: num(pt.redownloads), color: SERIES.aqua },
                { label: "Updates", value: num(pt.updates) },
              ]}
            />
          )}
        />
        <Bar dataKey="firstDownloads" stackId="d" fill={SERIES.blue} isAnimationActive={false} />
        <Bar dataKey="redownloads" stackId="d" fill={SERIES.aqua} radius={[2, 2, 0, 0]} isAnimationActive={false} />
      </BarChart>
    );
  } else if (metric === "conversion") {
    legend = [
      { label: "Impression → download", color: SERIES.blue },
      { label: "Page view → download", color: SERIES.orange },
    ];
    chart = (
      <LineChart data={points} margin={margin}>
        <Axes grain={grain} count={points.length} percent />
        <Tooltip
          content={(p) => (
            <ChartTooltip
              {...p}
              rows={(pt) => [
                { label: "Impression → download", value: pct(pt.conversion), color: SERIES.blue },
                { label: "Page view → download", value: pct(pt.pageViewConversion), color: SERIES.orange },
              ]}
            />
          )}
        />
        <Line dataKey="conversion" stroke={SERIES.blue} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
        <Line dataKey="pageViewConversion" stroke={SERIES.orange} strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
      </LineChart>
    );
  } else {
    const key = metric === "impressions" ? "impressions" : "pageViews";
    const unique = metric === "impressions" ? "impressionsUnique" : "pageViewsUnique";
    const label = metric === "impressions" ? "Impressions" : "Product page views";
    legend = [
      { label, color: SERIES.blue },
      { label: "Unique devices", color: SERIES.orange },
    ];
    chart = (
      <AreaChart data={points} margin={margin}>
        <Axes grain={grain} count={points.length} />
        <Tooltip
          content={(p) => (
            <ChartTooltip
              {...p}
              rows={(pt) => [
                { label, value: num(pt[key]), color: SERIES.blue },
                { label: "Unique", value: num(pt[unique]), color: SERIES.orange },
              ]}
            />
          )}
        />
        <Area dataKey={key} stroke={SERIES.blue} fill={SERIES.blue} fillOpacity={0.18} strokeWidth={2} isAnimationActive={false} />
        <Area dataKey={unique} stroke={SERIES.orange} fill="transparent" strokeWidth={1.5} strokeDasharray="4 3" isAnimationActive={false} />
      </AreaChart>
    );
  }

  return (
    <Panel
      title="Trend"
      description="Daily values from Apple's App Store Discovery and Engagement and App Downloads reports."
      actions={
        <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">
          <Segmented label="Metric" value={metric} options={METRICS} onChange={setMetric} />
          <Segmented
            label="Granularity"
            value={grain}
            options={[
              { key: "day", label: "Day" },
              { key: "week", label: "Week" },
            ]}
            onChange={setGrain}
          />
        </div>
      }
    >
      <Legend items={legend} />
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          {chart}
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
