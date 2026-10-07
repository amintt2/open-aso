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
import type { PosthogNewUsersResult, PosthogStatus } from "@/lib/posthog/types";
import { useApi } from "@/lib/client/api";
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

export default function OverviewTab({
  filters,
}: {
  filters: AnalyticsFilterState;
}) {
  const { data: posthog } = useApi<PosthogStatus>("/api/posthog/status");
  const posthogReady = !!posthog?.configured && posthog.mappedApps > 0;
  const { data: raw, error } = useAnalytics<OverviewResult>(
    "overview",
    filters,
    posthogReady ? { demo: "never" } : undefined,
  );
  const needsFallback =
    posthogReady && !!raw && !raw.demo && raw.totals.installs === 0;
  const { data: fallback } = useApi<PosthogNewUsersResult>(
    needsFallback
      ? `/api/posthog/newusers?days=${filters.days}${filters.appId === "all" ? "" : `&appId=${filters.appId}`}`
      : null,
    { shouldRetryOnError: false },
  );
  if (error) return <ErrorBlock message={error.message} />;
  if (!raw) return <LoadingBlock />;
  const viaPosthog =
    needsFallback && !!fallback && fallback.total + fallback.previousTotal > 0;
  const posthogDaily = new Map(
    (viaPosthog ? fallback.series : []).map((pt) => [pt.date, pt.newUsers]),
  );
  const data: OverviewResult = viaPosthog
    ? {
        ...raw,
        totals: { ...raw.totals, installs: fallback.total },
        previous: { ...raw.previous, installs: fallback.previousTotal },
        series: raw.series.map((pt) => ({
          ...pt,
          installs: posthogDaily.get(pt.date) ?? 0,
        })),
      }
    : raw;
  const installsLabel = viaPosthog ? "Installs via PostHog" : "Installs";
  const { totals: t, previous: p } = data;
  const tiles = [
    {
      label: installsLabel,
      value: formatCompact(t.installs),
      delta: <Delta current={t.installs} previous={p.installs} />,
      hint: viaPosthog
        ? "New users from PostHog first-open events — no SDK installs recorded for this period"
        : undefined,
    },
    {
      label: "Trials",
      value: formatCompact(t.trials),
      delta: <Delta current={t.trials} previous={p.trials} />,
    },
    {
      label: "Purchases",
      value: formatCompact(t.purchases),
      delta: <Delta current={t.purchases} previous={p.purchases} />,
      hint: "New paid purchases and trial conversions",
    },
    {
      label: "Gross revenue",
      value: formatUsd(t.grossRevenue),
      delta: <Delta current={t.grossRevenue} previous={p.grossRevenue} />,
    },
    {
      label: "Refunds",
      value: formatUsd(t.refunds),
      delta: <Delta current={t.refunds} previous={p.refunds} invert />,
    },
    {
      label: "Net revenue",
      value: formatUsd(t.netRevenue),
      delta: <Delta current={t.netRevenue} previous={p.netRevenue} />,
    },
  ];
  const tickInterval = data.days > 30 ? 13 : data.days > 7 ? 4 : 0;

  return (
    <div className="flex flex-col gap-4">
      <DemoBanner notice={data.notice} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((tile) => (
          <KpiTile key={tile.label} {...tile} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Installs & trials"
          description={`Daily, last ${data.days} days · trial → paid ${formatPercent(t.trialConversion)}${viaPosthog ? " · installs via PostHog" : ""}`}
          actions={
            <Legend
              items={[
                { label: installsLabel, color: SERIES.blue },
                { label: "Trials", color: SERIES.orange },
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
                          label: installsLabel,
                          value: formatCompact(pt.installs as number),
                          color: SERIES.blue,
                        },
                        {
                          label: "Trials",
                          value: formatCompact(pt.trials as number),
                          color: SERIES.orange,
                        },
                        {
                          label: "Purchases",
                          value: formatCompact(pt.purchases as number),
                        },
                      ]}
                    />
                  )}
                />
                <Bar
                  dataKey="installs"
                  fill={SERIES.blue}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={18}
                />
                <Line
                  dataKey="trials"
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
