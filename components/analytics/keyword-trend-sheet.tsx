"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { X } from "lucide-react";
import Button from "@/components/_ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/_ui/sheet";
import { ScrollArea } from "@/components/_ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/_ui/table";
import type { KeywordRoasRow, KeywordTrendResult } from "@/lib/analytics/types";
import { formatCompact, formatMoney, formatPercent } from "@/lib/client/format";
import {
  AXIS_TICK,
  ChartTooltip,
  GRID,
  Legend,
  SERIES,
  shortDate,
} from "./chart-kit";
import { ErrorBlock, LoadingBlock, RoasTag } from "./parts";
import { useAnalytics, type AnalyticsFilterState } from "./use-analytics";

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="caption-style text-subtle">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function TrendBody({
  row,
  filters,
  currency,
}: {
  row: KeywordRoasRow;
  filters: AnalyticsFilterState;
  currency: string;
}) {
  const { data, error } = useAnalytics<KeywordTrendResult>("trend", filters, {
    keywordId: row.keywordId,
  });
  const money = (v: number | null) =>
    v == null ? "—" : formatMoney(v, currency === "MIXED" ? "USD" : currency);
  if (error) return <ErrorBlock message={error.message} />;
  if (!data) return <LoadingBlock />;
  const interval = data.days > 30 ? 13 : data.days > 7 ? 4 : 0;
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
        <Stat label="Spend" value={money(row.spend)} />
        <Stat label="Installs" value={formatCompact(row.installs)} />
        <Stat label="CPI" value={money(row.cpi)} />
        <Stat label="Trial rate" value={formatPercent(row.trialRate)} />
        <Stat label="Revenue" value={formatMoney(row.revenue)} />
        <Stat label="ROAS" value={<RoasTag roas={row.roas} />} />
      </div>
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="h3-style">Spend vs revenue</h3>
          <Legend
            items={[
              { label: "Spend", color: SERIES.orange },
              { label: "Revenue", color: SERIES.aqua },
            ]}
          />
        </div>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.series}
              margin={{ top: 4, right: 4, bottom: 0, left: -6 }}
              barGap={2}
            >
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                interval={interval}
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
                        label: "Spend",
                        value: money(pt.spend as number),
                        color: SERIES.orange,
                      },
                      {
                        label: "Revenue",
                        value: formatMoney(pt.revenue as number),
                        color: SERIES.aqua,
                      },
                      {
                        label: "Installs",
                        value: formatCompact(pt.installs as number),
                      },
                      {
                        label: "Trials",
                        value: formatCompact(pt.trials as number),
                      },
                    ]}
                  />
                )}
              />
              <Bar
                dataKey="spend"
                fill={SERIES.orange}
                radius={[4, 4, 0, 0]}
                maxBarSize={12}
              />
              <Bar
                dataKey="revenue"
                fill={SERIES.aqua}
                radius={[4, 4, 0, 0]}
                maxBarSize={12}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="h3-style">Cumulative ROAS</h3>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
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
                interval={interval}
              />
              <YAxis
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v.toFixed(1)}×`}
              />
              <ReferenceLine y={1} stroke="#676767" strokeDasharray="4 4" />
              <Tooltip
                content={(props) => (
                  <ChartTooltip
                    {...props}
                    rows={(pt) => [
                      {
                        label: "ROAS to date",
                        value:
                          pt.cumulativeRoas == null
                            ? "—"
                            : `${(pt.cumulativeRoas as number).toFixed(2)}×`,
                        color: SERIES.blue,
                      },
                    ]}
                  />
                )}
              />
              <Line
                dataKey="cumulativeRoas"
                stroke={SERIES.blue}
                strokeWidth={2}
                dot={false}
                connectNulls
                activeDot={{ r: 4, strokeWidth: 2, stroke: "#161616" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="h3-style">Daily</h3>
        <div className="-mx-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Date</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead className="text-right">Taps</TableHead>
                <TableHead className="text-right">Installs</TableHead>
                <TableHead className="text-right">Trials</TableHead>
                <TableHead className="pr-6 text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...data.series].reverse().map((p) => (
                <TableRow key={p.date}>
                  <TableCell className="pl-6">{shortDate(p.date)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(p.spend)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCompact(p.taps)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCompact(p.installs)}
                    <span className="caption-style text-subtle">
                      {" "}
                      / {formatCompact(p.adsInstalls)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCompact(p.trials)}
                  </TableCell>
                  <TableCell className="pr-6 text-right tabular-nums">
                    {formatMoney(p.revenue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

export default function KeywordTrendSheet({
  row,
  filters,
  currency,
  onClose,
}: {
  row: KeywordRoasRow | null;
  filters: AnalyticsFilterState;
  currency: string;
  onClose: () => void;
}) {
  return (
    <Sheet open={!!row} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-[720px]">
        <SheetHeader>
          <div className="flex min-w-0 flex-col gap-1.5">
            <SheetTitle className="truncate">
              {row?.keyword ?? `Keyword ${row?.keywordId ?? ""}`}
            </SheetTitle>
            <SheetDescription>
              Last {filters.days} days · keyword {row?.keywordId}
            </SheetDescription>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          {row && <TrendBody row={row} filters={filters} currency={currency} />}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
