"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, ChartTooltip, GRID, Legend, Panel, shortDate } from "@/components/analytics/chart-kit";
import { formatCompact } from "@/lib/client/format";
import type { ImpactChartKey, ImpactResult } from "@/lib/impact/types";
import { BROWSE_COLOR, formatEstimate, KEYWORD_COLORS, OTHER_COLOR, PAID_COLOR } from "./impact-format";

function colorOf(key: ImpactChartKey, index: number) {
  if (key.kind === "keyword") return KEYWORD_COLORS[index % KEYWORD_COLORS.length];
  if (key.kind === "other") return OTHER_COLOR;
  if (key.kind === "browse") return BROWSE_COLOR;
  return PAID_COLOR;
}

export default function ImpactChart({ data }: { data: ImpactResult }) {
  const keys = data.chart.keys.map((k, i) => ({ ...k, color: colorOf(k, i) }));
  const tickInterval = data.days > 30 ? 13 : data.days > 7 ? 4 : 0;
  const hasData = data.chart.points.some((p) => keys.some((k) => Number(p[k.key] ?? 0) > 0));
  return (
    <Panel
      title="Installs by source over time"
      description={
        data.calibrated
          ? "Daily modelled split of observed installs: top tracked keywords, other searches, browse & referral, and Apple Ads."
          : "Daily uncalibrated estimate per tracked keyword (popularity × rank). Connect install data to see the full split."
      }
      actions={<Legend items={keys.map((k) => ({ label: k.label, color: k.color }))} className="max-w-[560px] justify-end" />}
    >
      <div className="h-[280px]">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.chart.points} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS_TICK} axisLine={false} tickLine={false} interval={tickInterval} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatCompact(v)} />
              <Tooltip
                cursor={{ stroke: "rgba(255,255,255,0.2)" }}
                content={(props) => (
                  <ChartTooltip
                    {...props}
                    rows={(pt) =>
                      [...keys].reverse().map((k) => ({ label: k.label, value: formatEstimate(Number(pt[k.key] ?? 0)), color: k.color }))
                    }
                  />
                )}
              />
              {keys.map((k) => (
                <Area
                  key={k.key}
                  type="monotone"
                  dataKey={k.key}
                  stackId="installs"
                  stroke={k.color}
                  fill={k.color}
                  fillOpacity={k.kind === "browse" ? 0.5 : 0.75}
                  strokeWidth={1}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-subtle flex h-full items-center justify-center">
            <p>No keyword ranks in the top 50 in this window, so there is nothing to split yet.</p>
          </div>
        )}
      </div>
    </Panel>
  );
}
