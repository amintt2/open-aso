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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/_ui/table";
import {
  AXIS_TICK,
  ChartTooltip,
  GRID,
  Legend,
  Panel,
  SERIES,
  shortDate,
} from "@/components/analytics/chart-kit";
import { Delta, KpiTile, MetricBar } from "@/components/analytics/parts";
import { formatCompact } from "@/lib/client/format";
import type { PosthogOverviewResult } from "@/lib/posthog/types";
import { EventName, MissingRoles, RoleTag, scopeLabel } from "./product-parts";
import { usePosthogView, type ProductTarget } from "./use-posthog";
import ViewFrame from "./view-frame";

export default function ProductOverview({
  target,
  onConnect,
}: {
  target: ProductTarget;
  onConnect: () => void;
}) {
  const view = usePosthogView<PosthogOverviewResult>("overview", target);
  return (
    <ViewFrame {...view} onConnect={onConnect} caption={scopeLabel}>
      {(data) => {
        const t = data.totals;
        const tickInterval = data.days > 30 ? 13 : data.days > 7 ? 4 : 0;
        const maxCount = Math.max(0, ...data.topEvents.map((e) => e.count));
        return (
          <>
            <MissingRoles
              roles={data.roles.install.length ? [] : ["install"]}
            />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              <KpiTile
                label="New users"
                value={formatCompact(t.newUsers)}
                delta={
                  <Delta current={t.newUsers} previous={t.previousNewUsers} />
                }
                hint="Unique people with a first-open event in the period"
              />
              <KpiTile
                label="Active users"
                value={formatCompact(t.activeUsers)}
                hint="Unique people with any event in the period"
              />
              <KpiTile
                label="Avg DAU"
                value={formatCompact(Math.round(t.dauAverage))}
              />
              <KpiTile
                label="WAU"
                value={formatCompact(t.wau)}
                hint="Unique people active in the last 7 days"
              />
              <KpiTile
                label="Events"
                value={formatCompact(t.events)}
                delta={<Delta current={t.events} previous={t.previousEvents} />}
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <Panel
                title="New users & daily actives"
                description="New users are people whose first-open event fired that day."
                actions={
                  <Legend
                    items={[
                      { label: "New users", color: SERIES.blue },
                      { label: "DAU", color: SERIES.orange },
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
                                label: "New users",
                                value: formatCompact(pt.newUsers as number),
                                color: SERIES.blue,
                              },
                              {
                                label: "DAU",
                                value: formatCompact(pt.dau as number),
                                color: SERIES.orange,
                              },
                            ]}
                          />
                        )}
                      />
                      <Bar
                        dataKey="newUsers"
                        fill={SERIES.blue}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={18}
                      />
                      <Line
                        dataKey="dau"
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
                title="Events per day"
                description={`${formatCompact(t.events)} events in the last ${data.days} days`}
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
                        tickFormatter={(v: number) => formatCompact(v)}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(255,255,255,0.04)" }}
                        content={(props) => (
                          <ChartTooltip
                            {...props}
                            rows={(pt) => [
                              {
                                label: "Events",
                                value: formatCompact(pt.events as number),
                                color: SERIES.aqua,
                              },
                            ]}
                          />
                        )}
                      />
                      <Bar
                        dataKey="events"
                        fill={SERIES.aqua}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={18}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </div>
            <Panel
              title="Top events"
              description="Canonical name (prefix stripped, separators normalized) with the raw PostHog event below it."
            >
              <div className="-mx-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Event</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="w-[140px]" />
                      <TableHead className="pr-4 text-right">Users</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topEvents.map((e) => (
                      <TableRow key={e.event}>
                        <TableCell className="max-w-[360px] pl-4">
                          <EventName canonical={e.canonical} raw={e.event} />
                        </TableCell>
                        <TableCell>
                          <RoleTag role={e.role} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCompact(e.count)}
                        </TableCell>
                        <TableCell>
                          <MetricBar
                            value={e.count}
                            max={maxCount}
                            color={SERIES.blue}
                          />
                        </TableCell>
                        <TableCell className="pr-4 text-right tabular-nums">
                          {formatCompact(e.users)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {!data.topEvents.length && (
                  <p className="text-subtle px-4 py-6">
                    No events for this app in the period.
                  </p>
                )}
              </div>
            </Panel>
          </>
        );
      }}
    </ViewFrame>
  );
}
