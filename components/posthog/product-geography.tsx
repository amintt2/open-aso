"use client";

import { useMemo, useState } from "react";
import WorldMap from "@/components/shell/world-map";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { Panel, SERIES } from "@/components/analytics/chart-kit";
import { MetricBar } from "@/components/analytics/parts";
import { COUNTRY_BY_CODE } from "@/lib/appstore/countries";
import { formatCompact } from "@/lib/client/format";
import type { PosthogGeographyResult } from "@/lib/posthog/types";
import { cn } from "@/lib/utils";
import { scopeLabel, Segmented } from "./product-parts";
import { usePosthogView, type ProductTarget } from "./use-posthog";
import ViewFrame from "./view-frame";

type Metric = "newUsers" | "activeUsers";

function countryLabel(code: string | null) {
  if (!code || code === "??") return { flag: "🌐", name: "Unknown" };
  const c = COUNTRY_BY_CODE.get(code);
  return { flag: c?.flag ?? "🏳️", name: c?.name ?? code.toUpperCase() };
}

export default function ProductGeography({ target, onConnect }: { target: ProductTarget; onConnect: () => void }) {
  const view = usePosthogView<PosthogGeographyResult>("geography", target);
  const [metric, setMetric] = useState<Metric>("newUsers");
  const [selected, setSelected] = useState<string | null>(null);
  const countries = view.data?.countries;
  const values = useMemo(() => Object.fromEntries((countries ?? []).filter((c) => c.country !== "??" && c[metric] > 0).map((c) => [c.country, Math.log1p(c[metric])])), [countries, metric]);
  const toggle = (code: string) => setSelected((s) => (s === code ? null : code));
  return (
    <ViewFrame {...view} onConnect={onConnect} caption={(d) => `${scopeLabel(d)} · country and city from PostHog GeoIP`}>
      {(data) => {
        const maxNew = Math.max(0, ...data.countries.map((c) => c.newUsers));
        const maxCity = Math.max(0, ...data.cities.map((c) => c[metric]));
        return (
          <>
            <Panel
              title="Where new users come from"
              description="$geoip_country_code of each person's events. New users fired a first-open event in the period."
              actions={
                <Segmented
                  label="Map metric"
                  value={metric}
                  onChange={setMetric}
                  options={[
                    { value: "newUsers", label: "New users" },
                    { value: "activeUsers", label: "Active users" },
                  ]}
                />
              }
            >
              <WorldMap
                values={values}
                format={(v) => `${formatCompact(Math.round(Math.expm1(v)))} ${metric === "newUsers" ? "new users" : "active users"}`}
                selected={selected}
                onSelect={toggle}
                legend={metric === "newUsers" ? "New users" : "Active users"}
              />
            </Panel>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Panel title="Countries" description={`${data.countries.length} countries in the last ${data.days} days`}>
                <div className="-mx-4 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">Country</TableHead>
                        <TableHead className="text-right">New users</TableHead>
                        <TableHead className="w-[140px]" />
                        <TableHead className="pr-4 text-right">Active users</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.countries.map((c) => {
                        const label = countryLabel(c.country);
                        return (
                          <TableRow key={c.country} data-selected={selected === c.country} className={cn("cursor-pointer hover:bg-white/3 data-[selected=true]:bg-white/5")} onClick={() => toggle(c.country)}>
                            <TableCell className="pl-4">
                              <span className="flex items-center gap-2">
                                <span aria-hidden>{label.flag}</span>
                                {label.name}
                              </span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatCompact(c.newUsers)}</TableCell>
                            <TableCell>
                              <MetricBar value={c.newUsers} max={maxNew} color={SERIES.blue} />
                            </TableCell>
                            <TableCell className="pr-4 text-right tabular-nums">{formatCompact(c.activeUsers)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {!data.countries.length && <p className="text-subtle px-4 py-6">No events in this period.</p>}
                </div>
              </Panel>
              <Panel title="Top cities" description="$geoip_city_name, ranked by the map metric.">
                {data.cities.length ? (
                  <ol className="flex flex-col gap-3">
                    {[...data.cities]
                      .sort((a, b) => b[metric] - a[metric])
                      .map((c, i) => (
                        <li key={`${c.city}-${c.country}`} className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-3">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="caption-style text-subtle w-5 tabular-nums">{i + 1}</span>
                              <span aria-hidden>{countryLabel(c.country).flag}</span>
                              <span className="truncate">{c.city}</span>
                            </span>
                            <span className="caption-style text-soft shrink-0 tabular-nums">
                              {formatCompact(c.newUsers)} new · {formatCompact(c.activeUsers)} active
                            </span>
                          </div>
                          <MetricBar value={c[metric]} max={maxCity} color={SERIES.blue} />
                        </li>
                      ))}
                  </ol>
                ) : (
                  <p className="text-subtle">No city data. GeoIP enrichment may be disabled for this project.</p>
                )}
              </Panel>
            </div>
          </>
        );
      }}
    </ViewFrame>
  );
}
