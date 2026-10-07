"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/_ui/tabs";

export type HistoryPoint = {
  date: string;
  popularity: number | null;
  difficulty: number | null;
  position: number | null;
};
export type VersionMarker = { version: string; releasedAt: string };

type Metric = "position" | "popularity" | "difficulty";
type Range = "7d" | "30d" | "90d" | "all";

const DAY = 86400000;
const RANGES: { key: Range; label: string; days: number | null }[] = [
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
  { key: "all", label: "All", days: null },
];
const METRICS: { key: Metric; label: string }[] = [
  { key: "position", label: "Position" },
  { key: "popularity", label: "Popularity" },
  { key: "difficulty", label: "Difficulty" },
];

const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const longDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function today() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function ChartTooltip({
  active,
  payload,
  metric,
}: {
  active?: boolean;
  payload?: readonly { payload?: unknown }[];
  metric: Metric;
}) {
  const point = payload?.[0]?.payload as
    | (HistoryPoint & { t: number })
    | undefined;
  if (!active || !point) return null;
  const value = point[metric];
  return (
    <div className="bg-popover border-line-strong shadow-overlay caption-style flex flex-col gap-1.5 rounded-md border px-2.5 py-2">
      <span className="text-subtle">{longDate.format(point.t)}</span>
      <span className="text-foreground tabular-nums">
        {metric === "position"
          ? value == null
            ? "Not in top 200"
            : `#${value}`
          : value == null
            ? "—"
            : `${METRICS.find((m) => m.key === metric)?.label} ${Math.round(value)}`}
      </span>
    </div>
  );
}

export default function KeywordTrendChart({
  history,
  versions,
  loading,
}: {
  history: HistoryPoint[] | undefined;
  versions: VersionMarker[] | undefined;
  loading: boolean;
}) {
  const [metric, setMetric] = useState<Metric>("position");
  const [range, setRange] = useState<Range>("30d");

  const { data, domain, markers } = useMemo(() => {
    const end = today();
    const points = (history ?? []).map((p) => ({
      ...p,
      t: Date.parse(`${p.date}T00:00:00Z`),
    }));
    const days = RANGES.find((r) => r.key === range)?.days;
    const start = days
      ? end - (days - 1) * DAY
      : Math.min(points[0]?.t ?? end - 29 * DAY, end - 6 * DAY);
    const inRange = points.filter((p) => p.t >= start);
    const marks = (versions ?? [])
      .map((v) => ({ version: v.version, t: Date.parse(v.releasedAt) }))
      .filter((v) => Number.isFinite(v.t) && v.t >= start && v.t <= end + DAY);
    return {
      data: inRange,
      domain: [start, end] as [number, number],
      markers: marks,
    };
  }, [history, versions, range]);

  const values = data
    .map((p) => p[metric])
    .filter((v): v is number => v != null);
  const yMax = Math.max(10, ...values);
  const yDomain: [number, number] =
    metric === "position" ? [1, yMax] : [0, 100];
  const yTicks =
    metric === "position"
      ? [
          ...new Set([
            1,
            Math.round(yMax / 3),
            Math.round((2 * yMax) / 3),
            yMax,
          ]),
        ]
      : [0, 25, 50, 75, 100];

  return (
    <section
      aria-label="Trend"
      className="border-border flex flex-col rounded-xl border"
    >
      <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-4">
        <Tabs value={metric} onValueChange={(v) => setMetric(v as Metric)}>
          <TabsList aria-label="Trend metric">
            {METRICS.map((m) => (
              <TabsTrigger key={m.key} value={m.key} className="py-3">
                {m.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div
          role="group"
          aria-label="Timeframe"
          className="bg-secondary flex items-center gap-0.5 rounded-full p-0.5 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.4),inset_0px_1px_0px_0px_rgba(255,255,255,0.06)]"
        >
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={range === r.key}
              onClick={() => setRange(r.key)}
              className="caption-style text-subtle hover:text-soft aria-pressed:bg-muted aria-pressed:text-foreground focus-visible:ring-ring/60 h-6 cursor-pointer rounded-full px-2.5 transition-colors duration-150 outline-none focus-visible:ring-2"
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative h-[220px] px-1 pt-4 pb-1">
        {loading ? (
          <div className="bg-muted/40 mx-3 h-[190px] animate-pulse rounded-lg" />
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 12, right: 16, bottom: 0, left: 0 }}
              >
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={domain}
                  tickFormatter={(t: number) => shortDate.format(t)}
                  tick={{ fill: "var(--subtle)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--line-strong)" }}
                  minTickGap={24}
                />
                <YAxis
                  reversed={metric === "position"}
                  domain={yDomain}
                  ticks={yTicks}
                  interval={0}
                  allowDecimals={false}
                  width={36}
                  tick={{ fill: "var(--subtle)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) =>
                    metric === "position" ? `#${v}` : String(v)
                  }
                />
                {markers.map((m) => (
                  <ReferenceLine
                    key={m.version}
                    x={m.t}
                    stroke="var(--faint)"
                    strokeDasharray="3 3"
                    label={
                      markers.length <= 6
                        ? {
                            value: `v${m.version}`,
                            position: "insideTopRight",
                            fill: "var(--subtle)",
                            fontSize: 10,
                          }
                        : undefined
                    }
                  />
                ))}
                <Tooltip
                  cursor={{ stroke: "var(--line-strong)" }}
                  content={(props) => (
                    <ChartTooltip
                      active={props.active}
                      payload={props.payload}
                      metric={metric}
                    />
                  )}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey={metric}
                  stroke="var(--status)"
                  strokeWidth={2}
                  dot={
                    data.length <= 31
                      ? { r: 3, strokeWidth: 0, fill: "var(--status)" }
                      : false
                  }
                  activeDot={{
                    r: 4,
                    strokeWidth: 2,
                    stroke: "var(--background)",
                  }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
            {values.length === 0 && (
              <p className="caption-style text-subtle pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
                {metric === "position" && data.length
                  ? "Not ranked in the top 200 during this period."
                  : "No history in this period yet. A snapshot is recorded every time the keyword is refreshed."}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
