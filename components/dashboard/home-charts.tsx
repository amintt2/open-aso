"use client";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AXIS_TICK,
  ChartTooltip,
  GRID,
  Legend,
  SERIES,
  shortDate,
} from "@/components/analytics/chart-kit";
import { LINE_COLORS } from "@/components/trends/trends-format";
import { useApi } from "@/lib/client/api";
import { formatCompact, formatUsd } from "@/lib/client/format";
import type { AppsResult, RevenueChart } from "@/lib/dashboard/types";
import {
  Card,
  ConnectHint,
  DemoTag,
  EstimateTag,
  Skeleton,
  WidgetError,
} from "./widget";

function ChartSkeleton() {
  return <Skeleton className="h-[240px] w-full" />;
}

export function VisibilityLines() {
  const { data, error } = useApi<AppsResult>("/api/dashboard/apps");
  const apps = useMemo(
    () =>
      (data?.apps ?? []).filter((a) =>
        a.series.some((p) => p.visibility != null),
      ),
    [data],
  );
  const rows = useMemo(
    () =>
      (data?.dates ?? []).map((date, i) => {
        const row: Record<string, number | string | null> = { date };
        for (const a of apps) row[`a${a.id}`] = a.series[i]?.visibility ?? null;
        return row;
      }),
    [data, apps],
  );
  return (
    <Card
      title="Visibility by app"
      description="Visibility score over the last 30 days. Modelled estimate."
      badge={<EstimateTag />}
    >
      {error && !data ? (
        <WidgetError message={error.message} />
      ) : !data ? (
        <ChartSkeleton />
      ) : !apps.length ? (
        <p className="caption-style text-subtle flex h-[240px] items-center justify-center text-center">
          No ranking history yet. Rankings are snapshotted on every refresh.
        </p>
      ) : (
        <>
          <div
            className="h-[240px]"
            role="img"
            aria-label="Visibility score per app over 30 days"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={rows}
                margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
              >
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  interval={4}
                />
                <YAxis
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  domain={[
                    0,
                    (max: number) =>
                      Math.min(100, Math.max(5, Math.ceil(max / 5) * 5)),
                  ]}
                />
                <Tooltip
                  cursor={{ stroke: "rgba(255,255,255,0.2)" }}
                  content={(props) => (
                    <ChartTooltip
                      {...props}
                      rows={(p) =>
                        apps.map((a, i) => ({
                          label: a.name,
                          value:
                            p[`a${a.id}`] == null
                              ? "—"
                              : Number(p[`a${a.id}`]).toFixed(1),
                          color: LINE_COLORS[i % LINE_COLORS.length],
                        }))
                      }
                    />
                  )}
                />
                {apps.map((a, i) => (
                  <Line
                    key={a.id}
                    type="monotone"
                    dataKey={`a${a.id}`}
                    stroke={LINE_COLORS[i % LINE_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <Legend
            items={apps.map((a, i) => ({
              label: a.name,
              color: LINE_COLORS[i % LINE_COLORS.length],
            }))}
          />
        </>
      )}
    </Card>
  );
}

export function InstallsRevenueChart() {
  const { data, error } = useApi<RevenueChart>(
    "/api/dashboard/revenue?days=30",
  );
  const installsLabel =
    data?.installsSource === "posthog"
      ? "New users (PostHog)"
      : data?.installsSource === "sdk"
        ? "Installs (SDK)"
        : "Installs";
  return (
    <Card
      title="Installs vs revenue"
      description="Daily installs and net revenue over the last 30 days."
      badge={
        data?.demo ? (
          <DemoTag title="Synthetic installs and revenue. Connect PostHog or the SDK and RevenueCat or Superwall to see yours." />
        ) : undefined
      }
    >
      {error && !data ? (
        <WidgetError message={error.message} />
      ) : !data ? (
        <ChartSkeleton />
      ) : (
        <>
          <div
            className="h-[240px]"
            role="img"
            aria-label="Installs and revenue per day over 30 days"
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={data.points}
                margin={{ top: 8, right: 0, bottom: 0, left: -12 }}
              >
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  interval={4}
                />
                <YAxis
                  yAxisId="installs"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  tickFormatter={(v: number) => formatCompact(v)}
                />
                <YAxis
                  yAxisId="revenue"
                  orientation="right"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={(v: number) => formatUsd(v)}
                  hide={!data.revenueAvailable}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  content={(props) => (
                    <ChartTooltip
                      {...props}
                      rows={(p) => [
                        ...(data.installsSource
                          ? [
                              {
                                label: installsLabel,
                                value: formatCompact(Number(p.installs)),
                                color: SERIES.blue,
                              },
                            ]
                          : []),
                        ...(data.revenueAvailable
                          ? [
                              {
                                label: "Net revenue",
                                value: formatUsd(Number(p.revenue)),
                                color: SERIES.aqua,
                              },
                            ]
                          : []),
                      ]}
                    />
                  )}
                />
                {data.installsSource && (
                  <Bar
                    yAxisId="installs"
                    dataKey="installs"
                    fill={SERIES.blue}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={14}
                    isAnimationActive={false}
                  />
                )}
                {data.revenueAvailable && (
                  <Line
                    yAxisId="revenue"
                    type="monotone"
                    dataKey="revenue"
                    stroke={SERIES.aqua}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Legend
              items={[
                ...(data.installsSource
                  ? [{ label: installsLabel, color: SERIES.blue }]
                  : []),
                ...(data.revenueAvailable
                  ? [{ label: "Net revenue", color: SERIES.aqua }]
                  : []),
              ]}
            />
            {(!data.installsSource || !data.revenueAvailable || data.demo) && (
              <ConnectHint
                className="py-0"
                label={
                  !data.revenueAvailable || data.demo
                    ? "Connect revenue & installs"
                    : "Connect installs"
                }
                href="/integrations"
              />
            )}
          </div>
        </>
      )}
    </Card>
  );
}
