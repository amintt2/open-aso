"use client";

import { useState } from "react";
import WorldMap from "@/components/shell/world-map";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import type { CountryPoint } from "@/lib/apple-ads/types";
import { cn } from "@/lib/utils";
import { DetailSheet } from "./bits";
import { count, countryLabel, countryName, money } from "./format";
import { useAdsUi } from "./store";

type MetricKey = "spend" | "installs" | "cpa";

const METRICS: { key: MetricKey; label: string }[] = [
  { key: "spend", label: "Spend" },
  { key: "installs", label: "Installs" },
  { key: "cpa", label: "CPA" },
];

export default function MapSheet({ countries, currency }: { countries: CountryPoint[]; currency: string }) {
  const open = useAdsUi((s) => s.sheet === "map");
  const openSheet = useAdsUi((s) => s.openSheet);
  const [metric, setMetric] = useState<MetricKey>("spend");
  const [selected, setSelected] = useState<string | null>(null);
  const value = (c: CountryPoint) => (metric === "cpa" ? (c.installs ? c.spend / c.installs : null) : c[metric]);
  const values = Object.fromEntries(countries.filter((c) => c.spend > 0 || c.installs > 0).map((c) => [c.country, value(c)]));
  const fmt = (v: number) => (metric === "installs" ? count(v) : money(v, currency, metric === "spend" && v >= 1000 ? 0 : 2));

  return (
    <DetailSheet open={open} onOpenChange={(o) => !o && openSheet(null)} width="sm:max-w-[920px]" title="Spend & installs by country" description="Apple Ads delivery per storefront for the selected range">
      <div className="flex flex-col gap-5 p-6">
        <div role="radiogroup" aria-label="Map metric" className="flex gap-1.5">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={metric === m.key}
              onClick={() => setMetric(m.key)}
              className={cn("caption-style border-border text-subtle hover:text-foreground h-7 cursor-pointer rounded-full border px-3 transition-colors", metric === m.key && "bg-muted text-foreground border-line-strong")}
            >
              {m.label}
            </button>
          ))}
        </div>
        <WorldMap values={values} format={fmt} invert={metric === "cpa"} selected={selected} onSelect={setSelected} legend={METRICS.find((m) => m.key === metric)?.label} />
        <div className="border-border overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Country</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead className="text-right">Impr.</TableHead>
                <TableHead className="text-right">Taps</TableHead>
                <TableHead className="text-right">Installs</TableHead>
                <TableHead className="text-right">CPA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {countries.map((c) => (
                <TableRow key={c.country} data-selected={selected === c.country} className="data-[selected=true]:bg-white/4 cursor-pointer" onClick={() => setSelected(c.country)}>
                  <TableCell>
                    {countryLabel(c.country)} <span className="text-subtle">{countryName(c.country)}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{money(c.spend, currency)}</TableCell>
                  <TableCell className="text-right tabular-nums">{count(c.impressions)}</TableCell>
                  <TableCell className="text-right tabular-nums">{count(c.taps)}</TableCell>
                  <TableCell className="text-right tabular-nums">{count(c.installs)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(c.installs ? c.spend / c.installs : null, currency)}</TableCell>
                </TableRow>
              ))}
              {!countries.length && (
                <TableRow>
                  <TableCell colSpan={6} className="text-subtle py-6 text-center">
                    No country data for this range.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DetailSheet>
  );
}
