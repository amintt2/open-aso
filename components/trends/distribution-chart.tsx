"use client";

import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, ChartTooltip, GRID, Legend, Panel, shortDate } from "@/components/analytics/chart-kit";
import type { TrendPoint } from "@/lib/trends/types";
import { BUCKETS } from "./trends-format";
import { tickInterval } from "./visibility-chart";

export default function DistributionChart({ points, days }: { points: TrendPoint[]; days: number }) {
  const data = useMemo(
    () => points.map((p) => (p.tracked ? p : { date: p.date, tracked: 0, top3: null, top10: null, top50: null, top200: null, unranked: null })),
    [points],
  );
  return (
    <Panel
      title="Rank distribution"
      description="How many tracked keywords sit in each position band, per day."
      actions={<Legend items={BUCKETS.map((b) => ({ label: b.label, color: b.color }))} className="justify-end" />}
    >
      <div className="h-[260px]" role="img" aria-label={`Keywords per position band over the last ${days} days`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS_TICK} axisLine={false} tickLine={false} interval={tickInterval(days)} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} allowDecimals={false} />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.2)" }}
              content={(props) => (
                <ChartTooltip
                  {...props}
                  rows={(pt) =>
                    pt.tracked
                      ? [...BUCKETS.map((b) => ({ label: b.label, value: String(pt[b.key] ?? 0), color: b.color })), { label: "Total", value: String(pt.tracked) }]
                      : [{ label: "No data yet", value: "" }]
                  }
                />
              )}
            />
            {BUCKETS.map((b) => (
              <Area
                key={b.key}
                type="linear"
                dataKey={b.key}
                name={b.label}
                stackId="bands"
                stroke={b.color}
                fill={b.color}
                fillOpacity={0.85}
                strokeWidth={1}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
