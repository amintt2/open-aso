"use client";

import { useMemo, useState } from "react";
import { Panel } from "@/components/analytics/chart-kit";
import { MetricBar } from "@/components/analytics/parts";
import WorldMap from "@/components/shell/world-map";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import type { TerritoryBreakdown as Row } from "@/lib/asc/analytics/types";
import { formatCompact, formatPercent, formatUsd } from "@/lib/client/format";
import { cn } from "@/lib/utils";
import { territoryName } from "./format";
import { Segmented, SmallDelta } from "./parts";

type Metric = "firstDownloads" | "impressions";

const LIMIT = 12;

export default function TerritoryBreakdown({ territories, selected, onSelect }: { territories: Row[]; selected: string; onSelect: (code: string) => void }) {
  const [metric, setMetric] = useState<Metric>("firstDownloads");
  const [all, setAll] = useState(false);
  const values = useMemo(() => Object.fromEntries(territories.filter((t) => t[metric] > 0).map((t) => [t.territory, Math.log1p(t[metric])])), [territories, metric]);
  const max = Math.max(0, ...territories.map((t) => t.firstDownloads));
  const shown = all ? territories : territories.slice(0, LIMIT);
  const hasProceeds = territories.some((t) => t.proceeds !== 0);

  return (
    <Panel
      title="Territories"
      description="All App Store territories for this app. Click a country to filter the page."
      actions={
        <Segmented
          label="Map metric"
          value={metric}
          options={[
            { key: "firstDownloads", label: "Downloads" },
            { key: "impressions", label: "Impressions" },
          ]}
          onChange={setMetric}
        />
      }
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <WorldMap
          values={values}
          format={(v) => formatCompact(Math.round(Math.expm1(v)))}
          selected={selected === "all" ? null : selected}
          onSelect={onSelect}
          legend={metric === "firstDownloads" ? "First-time downloads" : "Impressions"}
        />
        <div className="-mx-4 overflow-x-auto px-4">
          <Table className="min-w-[520px]">
            <TableHeader>
              <TableRow>
                <TableHead>Territory</TableHead>
                <TableHead className="text-right">Downloads</TableHead>
                <TableHead className="text-right">Δ</TableHead>
                <TableHead className="text-right">Impressions</TableHead>
                <TableHead className="text-right">CVR</TableHead>
                {hasProceeds && <TableHead className="text-right">Proceeds (USD)</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((t) => {
                const info = territoryName(t.territory);
                return (
                  <TableRow
                    key={t.territory}
                    onClick={() => onSelect(t.territory)}
                    className={cn("hover:bg-secondary/60 cursor-pointer", selected === t.territory && "bg-secondary")}
                  >
                    <TableCell>
                      <span className="flex min-w-0 flex-col gap-1.5">
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          <span aria-hidden>{info.flag}</span>
                          <span className="truncate">{info.name}</span>
                        </span>
                        <MetricBar value={t.firstDownloads} max={max} color="#22c55e" />
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCompact(t.firstDownloads)}</TableCell>
                    <TableCell className="text-right">
                      <SmallDelta current={t.firstDownloads} previous={t.previousFirstDownloads} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCompact(t.impressions)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPercent(t.conversion, 1)}</TableCell>
                    {hasProceeds && <TableCell className="text-right tabular-nums">{formatUsd(t.proceeds)}</TableCell>}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {territories.length > LIMIT && (
            <button type="button" onClick={() => setAll(!all)} className="caption-style text-soft hover:text-foreground mt-3 cursor-pointer">
              {all ? "Show top territories" : `Show all ${territories.length} territories`}
            </button>
          )}
        </div>
      </div>
    </Panel>
  );
}
