"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/_ui/table";
import type { SourceRow, SourcesResult } from "@/lib/analytics/types";
import { formatCompact, formatMoney, formatPercent } from "@/lib/client/format";
import {
  AXIS_TICK,
  ChartTooltip,
  GRID,
  Legend,
  Panel,
  SERIES,
  shortDate,
} from "./chart-kit";
import { DemoBanner, ErrorBlock, LoadingBlock, MetricBar } from "./parts";
import { useAnalytics, type AnalyticsFilterState } from "./use-analytics";

const SOURCE_META: Record<
  SourceRow["source"],
  { label: string; color: string }
> = {
  apple_ads: { label: "Apple Ads", color: SERIES.blue },
  organic: { label: "Organic", color: SERIES.orange },
};

function SourceCard({ row, share }: { row: SourceRow; share: number | null }) {
  const meta = SOURCE_META[row.source];
  const stats = [
    { label: "Installs", value: formatCompact(row.installs) },
    { label: "Trials", value: formatCompact(row.trials) },
    { label: "Trial rate", value: formatPercent(row.trialRate) },
    { label: "Paying", value: formatCompact(row.payers) },
    { label: "Conversion", value: formatPercent(row.conversion) },
    { label: "Revenue", value: formatMoney(row.revenue) },
    { label: "Revenue / install", value: formatMoney(row.revenuePerInstall) },
  ];
  return (
    <section className="bg-card border-border flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="h3-style flex items-center gap-2">
          <span
            aria-hidden
            className="size-2.5 rounded-[3px]"
            style={{ background: meta.color }}
          />
          {meta.label}
        </h2>
        <span className="caption-style text-subtle">
          {formatPercent(share)} of installs
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-1.5">
            <dt className="caption-style text-subtle">{s.label}</dt>
            <dd className="tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function SourcesTab({
  filters,
}: {
  filters: AnalyticsFilterState;
}) {
  const { data, error } = useAnalytics<SourcesResult>("sources", filters);
  if (error) return <ErrorBlock message={error.message} />;
  if (!data) return <LoadingBlock />;
  const total = data.sources.reduce((a, s) => a + s.installs, 0);
  const maxRevenue = Math.max(0, ...data.campaigns.map((c) => c.revenue));
  return (
    <div className="flex flex-col gap-4">
      <DemoBanner notice={data.notice} />
      <div className="grid gap-4 lg:grid-cols-2">
        {data.sources.map((row) => (
          <SourceCard
            key={row.source}
            row={row}
            share={total ? row.installs / total : null}
          />
        ))}
      </div>
      <Panel
        title="Installs by source"
        description="Trials, conversion and revenue are cohort-based: they follow users who installed in this period."
        actions={
          <Legend
            items={Object.values(SOURCE_META).map((m) => ({
              label: m.label,
              color: m.color,
            }))}
          />
        }
      >
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.daily}
              margin={{ top: 4, right: 4, bottom: 0, left: -12 }}
            >
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                interval={data.days > 30 ? 13 : data.days > 7 ? 4 : 0}
              />
              <YAxis
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                content={(props) => (
                  <ChartTooltip
                    {...props}
                    rows={(pt) => [
                      {
                        label: "Apple Ads",
                        value: formatCompact(pt.apple_ads as number),
                        color: SERIES.blue,
                      },
                      {
                        label: "Organic",
                        value: formatCompact(pt.organic as number),
                        color: SERIES.orange,
                      },
                    ]}
                  />
                )}
              />
              <Bar
                dataKey="organic"
                stackId="s"
                fill={SERIES.orange}
                maxBarSize={18}
                stroke="#1b1d20"
                strokeWidth={1}
              />
              <Bar
                dataKey="apple_ads"
                stackId="s"
                fill={SERIES.blue}
                radius={[4, 4, 0, 0]}
                maxBarSize={18}
                stroke="#1b1d20"
                strokeWidth={1}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {data.unattributedRevenue !== 0 && (
          <p className="caption-style text-subtle">
            {formatMoney(data.unattributedRevenue)} of revenue in this period
            came from users with no install record (SDK not installed for them,
            or ids not linked).
          </p>
        )}
      </Panel>
      <Panel
        title="Apple Ads campaigns"
        description="Installs attributed via AdServices, with spend from Apple Ads reports."
      >
        {data.campaigns.length ? (
          <div className="-mx-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Campaign</TableHead>
                  <TableHead className="text-right">Installs</TableHead>
                  <TableHead className="text-right">Trials</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="w-[160px]" />
                  <TableHead className="pr-4 text-right">ROAS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.campaigns.map((c) => (
                  <TableRow key={c.campaignId}>
                    <TableCell className="pl-4 font-mono text-[13px]">
                      {c.campaignId}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCompact(c.installs)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCompact(c.trials)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.spend ? formatMoney(c.spend) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(c.revenue)}
                    </TableCell>
                    <TableCell>
                      <MetricBar
                        value={c.revenue}
                        max={maxRevenue}
                        color={SERIES.aqua}
                      />
                    </TableCell>
                    <TableCell className="pr-4 text-right tabular-nums">
                      {c.roas == null ? "—" : `${c.roas.toFixed(2)}×`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-subtle">
            No Apple Ads-attributed installs in this period.
          </p>
        )}
      </Panel>
    </div>
  );
}
