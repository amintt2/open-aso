"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { OverviewResult } from "@/lib/analytics/types";
import {
  formatCompact,
  formatMoney,
  formatPercent,
  formatUsd,
} from "@/lib/client/format";
import {
  AXIS_TICK,
  ChartTooltip,
  GRID,
  Legend,
  Panel,
  SERIES,
  shortDate,
} from "./chart-kit";
import { Delta, DemoBanner, ErrorBlock, KpiTile, LoadingBlock } from "./parts";
import { useAnalytics, type AnalyticsFilterState } from "./use-analytics";

export default function RevenueTab({
  filters,
}: {
  filters: AnalyticsFilterState;
}) {
  const { data, error } = useAnalytics<OverviewResult>("overview", filters);
  if (error) return <ErrorBlock message={error.message} />;
  if (!data) return <LoadingBlock />;
  const { totals: t, previous: p } = data;
  const period = `${data.days}d`;
  const tiles = [
    {
      label: `Trials · ${period}`,
      value: formatCompact(t.trials),
      delta: <Delta current={t.trials} previous={p.trials} />,
      hint: "Free trials started in the period",
    },
    {
      label: `Purchases · ${period}`,
      value: formatCompact(t.purchases),
      delta: <Delta current={t.purchases} previous={p.purchases} />,
      hint: "New paid purchases and trial conversions",
    },
    {
      label: `Gross revenue · ${period}`,
      value: formatUsd(t.grossRevenue),
      delta: <Delta current={t.grossRevenue} previous={p.grossRevenue} />,
    },
    {
      label: `Refunds · ${period}`,
      value: formatUsd(t.refunds),
      delta: <Delta current={t.refunds} previous={p.refunds} invert />,
    },
    {
      label: `Net revenue · ${period}`,
      value: formatUsd(t.netRevenue),
      delta: <Delta current={t.netRevenue} previous={p.netRevenue} />,
      hint: "Gross revenue minus refunds, in USD. Same number as the last step of the funnel above.",
    },
  ];
  const tickInterval = data.days > 30 ? 13 : data.days > 7 ? 4 : 0;

  return (
    <div className="flex flex-col gap-4">
      <DemoBanner notice={data.notice} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {tiles.map((tile) => (
          <KpiTile key={tile.label} source="revenue" {...tile} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Trials & purchases"
          description={`Daily, last ${data.days} days · trial → paid ${formatPercent(t.trialConversion)}`}
          actions={
            <Legend
              items={[
                { label: "Trials", color: SERIES.blue },
                { label: "Purchases", color: SERIES.orange },
              ]}
            />
          }
        >
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={data.series}
                margin={{ top: 4, right: 4, bottom: 0, left: -12 }}
              >
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  interval={tickInterval}
                />
                <YAxis
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  tickFormatter={(v: number) => formatCompact(v)}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  content={(props) => (
                    <ChartTooltip
                      {...props}
                      rows={(pt) => [
                        {
                          label: "Trials",
                          value: formatCompact(pt.trials as number),
                          color: SERIES.blue,
                        },
                        {
                          label: "Purchases",
                          value: formatCompact(pt.purchases as number),
                          color: SERIES.orange,
                        },
                      ]}
                    />
                  )}
                />
                <Bar
                  dataKey="trials"
                  fill={SERIES.blue}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={18}
                />
                <Line
                  dataKey="purchases"
                  stroke={SERIES.orange}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "#1b1d20" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel
          title="Net revenue"
          description={`Daily gross minus refunds, USD · ${formatMoney(t.netRevenue)} total`}
        >
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.series}
                margin={{ top: 4, right: 4, bottom: 0, left: -6 }}
              >
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  interval={tickInterval}
                />
                <YAxis
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => formatUsd(v)}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  content={(props) => (
                    <ChartTooltip
                      {...props}
                      rows={(pt) => [
                        {
                          label: "Net",
                          value: formatMoney(pt.netRevenue as number),
                          color: SERIES.aqua,
                        },
                        {
                          label: "Gross",
                          value: formatMoney(pt.grossRevenue as number),
                        },
                        {
                          label: "Refunds",
                          value: formatMoney(pt.refunds as number),
                        },
                      ]}
                    />
                  )}
                />
                <Bar
                  dataKey="netRevenue"
                  fill={SERIES.aqua}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  );
}
