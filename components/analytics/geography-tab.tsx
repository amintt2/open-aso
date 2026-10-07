"use client";

import { useMemo, useState } from "react";
import WorldMap from "@/components/shell/world-map";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/_ui/table";
import { COUNTRY_BY_CODE } from "@/lib/appstore/countries";
import type { GeographyResult } from "@/lib/analytics/types";
import { formatCompact, formatMoney, formatUsd } from "@/lib/client/format";
import { cn } from "@/lib/utils";
import { Panel, SERIES } from "./chart-kit";
import { DemoBanner, ErrorBlock, LoadingBlock, MetricBar } from "./parts";
import { useAnalytics, type AnalyticsFilterState } from "./use-analytics";

type Metric = "installs" | "revenue";

function countryLabel(code: string) {
  if (code === "??") return { flag: "🌐", name: "Unknown" };
  const c = COUNTRY_BY_CODE.get(code);
  return { flag: c?.flag ?? "🏳️", name: c?.name ?? code.toUpperCase() };
}

export default function GeographyTab({
  filters,
}: {
  filters: AnalyticsFilterState;
}) {
  const { data, error } = useAnalytics<GeographyResult>("geography", filters);
  const [metric, setMetric] = useState<Metric>("installs");
  const [selected, setSelected] = useState<string | null>(null);
  const values = useMemo(
    () =>
      Object.fromEntries(
        (data?.countries ?? [])
          .filter((c) => c.country !== "??" && c[metric] > 0)
          .map((c) => [c.country, Math.log1p(c[metric])]),
      ),
    [data, metric],
  );
  if (error) return <ErrorBlock message={error.message} />;
  if (!data) return <LoadingBlock />;
  const maxInstalls = Math.max(0, ...data.countries.map((c) => c.installs));
  const maxCity = Math.max(0, ...data.cities.map((c) => c.installs));

  return (
    <div className="flex flex-col gap-4">
      <DemoBanner notice={data.notice} />
      <Panel
        title="Where your users are"
        description="Install country comes from the SDK (device region) or the Apple Ads campaign; revenue country from RevenueCat/Superwall."
        actions={
          <div
            role="radiogroup"
            aria-label="Map metric"
            className="bg-secondary flex h-[30px] items-center rounded-full p-0.5"
          >
            {(["installs", "revenue"] as Metric[]).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={metric === m}
                onClick={() => setMetric(m)}
                className={cn(
                  "caption-style h-full cursor-pointer rounded-full px-3 capitalize transition-colors duration-150",
                  metric === m
                    ? "bg-muted text-foreground"
                    : "text-subtle hover:text-soft",
                )}
              >
                {m}
              </button>
            ))}
          </div>
        }
      >
        <WorldMap
          values={values}
          format={
            metric === "revenue"
              ? (v) => formatMoney(Math.expm1(v))
              : (v) => `${formatCompact(Math.round(Math.expm1(v)))} installs`
          }
          selected={selected}
          onSelect={(code) => setSelected((s) => (s === code ? null : code))}
          legend={metric === "revenue" ? "Revenue (USD)" : "Installs"}
        />
      </Panel>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel
          title="Countries"
          description={`${data.countries.length} countries in the last ${data.days} days`}
        >
          <div className="-mx-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Country</TableHead>
                  <TableHead className="text-right">Installs</TableHead>
                  <TableHead className="w-[120px]" />
                  <TableHead className="text-right">Trials</TableHead>
                  <TableHead className="text-right">Paying</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="pr-4 text-right">
                    Rev / install
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.countries.map((c) => {
                  const label = countryLabel(c.country);
                  return (
                    <TableRow
                      key={c.country}
                      data-selected={selected === c.country}
                      className="cursor-pointer hover:bg-white/3 data-[selected=true]:bg-white/5"
                      onClick={() =>
                        setSelected((s) => (s === c.country ? null : c.country))
                      }
                    >
                      <TableCell className="pl-4">
                        <span className="flex items-center gap-2">
                          <span aria-hidden>{label.flag}</span>
                          {label.name}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCompact(c.installs)}
                      </TableCell>
                      <TableCell>
                        <MetricBar
                          value={c.installs}
                          max={maxInstalls}
                          color={SERIES.blue}
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCompact(c.trials)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCompact(c.payers)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(c.revenue)}
                      </TableCell>
                      <TableCell className="pr-4 text-right tabular-nums">
                        {formatMoney(c.revenuePerInstall)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {!data.countries.length && (
              <p className="text-subtle px-4 py-6">
                No installs or revenue in this period.
              </p>
            )}
          </div>
        </Panel>
        <Panel
          title="Top cities"
          description="From the city the SDK reports, if you send one."
        >
          {data.cities.length ? (
            <ol className="flex flex-col gap-3">
              {data.cities.map((c, i) => (
                <li
                  key={`${c.city}-${c.country}`}
                  className="flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="caption-style text-subtle w-5 tabular-nums">
                        {i + 1}
                      </span>
                      <span aria-hidden>
                        {c.country ? countryLabel(c.country).flag : ""}
                      </span>
                      <span className="truncate">{c.city}</span>
                    </span>
                    <span className="caption-style text-soft shrink-0 tabular-nums">
                      {formatCompact(c.installs)} · {formatUsd(c.revenue)}
                    </span>
                  </div>
                  <MetricBar
                    value={c.installs}
                    max={maxCity}
                    color={SERIES.blue}
                  />
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-subtle">
              No city data yet. Pass a city to /api/attribution/install to
              populate this list.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}
