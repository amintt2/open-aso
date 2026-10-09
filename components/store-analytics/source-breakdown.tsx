"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, ChartTooltip, GRID, Legend, Panel, shortDate } from "@/components/analytics/chart-kit";
import { MetricBar } from "@/components/analytics/parts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import type { SourceBreakdown as Row } from "@/lib/asc/analytics/types";
import { formatCompact, formatPercent } from "@/lib/client/format";
import { bucketRows, SOURCE_META } from "./format";
import { Segmented, SmallDelta } from "./parts";

type Metric = "firstDownloads" | "impressions" | "pageViews";

const METRICS: { key: Metric; label: string }[] = [
  { key: "firstDownloads", label: "Downloads" },
  { key: "impressions", label: "Impressions" },
  { key: "pageViews", label: "Page views" },
];

export default function SourceBreakdown({ sources, sourceDaily, days }: { sources: Row[]; sourceDaily: Record<string, number | string>[]; days: number }) {
  const [metric, setMetric] = useState<Metric>("firstDownloads");
  const week = days > 30;
  const data = useMemo(() => bucketRows(sourceDaily, week), [sourceDaily, week]);
  const order = sources.map((s) => s.source);
  const maxDownloads = Math.max(0, ...sources.map((s) => s.firstDownloads));
  const search = sources.find((s) => s.source === "search");

  return (
    <Panel
      title="Sources"
      description={
        search?.share != null
          ? `${formatPercent(search.share, 0)} of first-time downloads came from App Store search (includes Apple Ads taps).`
          : "Where people discovered the app, as classified by Apple."
      }
      actions={<Segmented label="Source metric" value={metric} options={METRICS} onChange={setMetric} />}
    >
      <Legend items={order.map((s) => ({ label: SOURCE_META[s].label, color: SOURCE_META[s].color }))} />
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => formatCompact(v)} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              content={(p) => (
                <ChartTooltip
                  {...p}
                  rows={(pt) =>
                    order.map((s) => ({ label: SOURCE_META[s].label, value: formatCompact(Number(pt[`${s}:${metric}`]) || 0), color: SOURCE_META[s].color }))
                  }
                />
              )}
            />
            {order.map((s, i) => (
              <Bar key={s} dataKey={`${s}:${metric}`} stackId="s" fill={SOURCE_META[s].color} radius={i === order.length - 1 ? [2, 2, 0, 0] : undefined} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="-mx-4 overflow-x-auto px-4">
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Impressions</TableHead>
              <TableHead className="text-right">Page views</TableHead>
              <TableHead className="text-right">First-time downloads</TableHead>
              <TableHead className="w-[120px]">Share</TableHead>
              <TableHead className="text-right">Conversion</TableHead>
              <TableHead className="text-right">Δ downloads</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((s) => (
              <TableRow key={s.source}>
                <TableCell>
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <span aria-hidden className="size-2 rounded-[2px]" style={{ background: SOURCE_META[s.source].color }} />
                    {SOURCE_META[s.source].label}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCompact(s.impressions)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCompact(s.pageViews)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCompact(s.firstDownloads)}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <MetricBar value={s.firstDownloads} max={maxDownloads} color={SOURCE_META[s.source].color} />
                    <span className="caption-style text-subtle w-9 text-right tabular-nums">{formatPercent(s.share, 0)}</span>
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatPercent(s.conversion, 2)}</TableCell>
                <TableCell className="text-right">
                  <SmallDelta current={s.firstDownloads} previous={s.previousFirstDownloads} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}
