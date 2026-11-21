"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Panel } from "@/components/analytics/chart-kit";
import { SourceChip, type KpiSource } from "@/components/analytics/parts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { approxInstalls, countryName, flagOf, formatPosition } from "@/components/trends/trends-format";
import { formatCompact, formatUsd } from "@/lib/client/format";
import type { TrafficCountry, TrafficResult } from "@/lib/traffic/types";
import { cn } from "@/lib/utils";

type SortKey = "downloads" | "firstOpens" | "estSearch" | "top10" | "revenue";

const COLUMNS: { key: SortKey; label: string; source: KpiSource; hint: string }[] = [
  { key: "downloads", label: "First-time downloads", source: "apple", hint: "First-time downloads in the period, reported by Apple" },
  { key: "firstOpens", label: "First opens", source: "posthog", hint: "First-open events in the period, counted by PostHog" },
  { key: "estSearch", label: "Est. search installs / day", source: "estimate", hint: "Installs per day the rankings model expects from the keywords you track in this country" },
  { key: "top10", label: "Keywords in top 10", source: "measured", hint: "Tracked keywords ranked 1 to 10 today, out of the keywords tracked in this country" },
];

const LIMIT = 15;

function cell(value: number | null, format: (n: number) => string) {
  return value == null ? <span className="text-faint">—</span> : format(value);
}

export default function CountriesTable({ data, appId, onSelect }: { data: TrafficResult; appId: number; onSelect: (code: string) => void }) {
  const [sort, setSort] = useState<SortKey>("downloads");
  const [all, setAll] = useState(false);
  const hasRevenue = data.countries.some((c) => c.revenue);
  const rows = useMemo(() => {
    const pick = (c: TrafficCountry) => c[sort] ?? -1;
    return [...data.countries].sort((a, b) => pick(b) - pick(a) || (b.downloads ?? 0) - (a.downloads ?? 0) || (b.estSearch ?? 0) - (a.estSearch ?? 0));
  }, [data.countries, sort]);
  const visible = all ? rows : rows.slice(0, LIMIT);
  const columns = hasRevenue ? [...COLUMNS, { key: "revenue" as const, label: "Net revenue", source: "revenue" as const, hint: "Revenue after refunds in the period, in USD" }] : COLUMNS;

  return (
    <Panel
      title="Countries"
      description={`Where downloads come from and whether your keywords rank there. Last ${data.days} days, all countries. Click a row to filter the page on that country.`}
    >
      {rows.length ? (
        <div className="-mx-4 overflow-x-auto">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Country</TableHead>
                {columns.map((c) => (
                  <TableHead key={c.key} className="text-right" aria-sort={sort === c.key ? "descending" : "none"}>
                    <button
                      type="button"
                      title={`${c.hint}. Click to sort.`}
                      onClick={() => setSort(c.key)}
                      className={cn("focus-visible:ring-ring/60 inline-flex cursor-pointer items-center gap-1.5 rounded outline-none focus-visible:ring-2", sort === c.key ? "text-foreground" : "hover:text-soft")}
                    >
                      {c.label}
                      <SourceChip source={c.source} />
                      {sort === c.key && <span aria-hidden>↓</span>}
                    </button>
                  </TableHead>
                ))}
                <TableHead className="pr-4">Best keyword</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((c) => (
                <TableRow
                  key={c.country}
                  onClick={() => onSelect(c.country)}
                  aria-selected={data.country === c.country}
                  className={cn("cursor-pointer hover:bg-white/4", data.country === c.country && "bg-secondary")}
                >
                  <TableCell className="pl-4">
                    <span className="flex items-center gap-2">
                      <span aria-hidden>{flagOf(c.country)}</span>
                      <span className="truncate">{countryName(c.country)}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{cell(c.downloads, formatCompact)}</TableCell>
                  <TableCell className="text-right tabular-nums">{cell(c.firstOpens, formatCompact)}</TableCell>
                  <TableCell className="text-right tabular-nums">{cell(c.estSearch, approxInstalls)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.keywords ? (
                      <>
                        {c.top10} <span className="text-subtle">/ {c.keywords}</span>
                      </>
                    ) : (
                      <span className="text-subtle" title="No keyword tracked in this country">
                        none tracked
                      </span>
                    )}
                  </TableCell>
                  {hasRevenue && <TableCell className="text-right tabular-nums">{cell(c.revenue, formatUsd)}</TableCell>}
                  <TableCell className="pr-4">
                    {c.best ? (
                      <Link
                        href={`/apps/${appId}/keywords?q=${encodeURIComponent(c.best.term)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-foreground text-soft inline-flex max-w-[220px] items-center gap-1.5"
                        title={`Open “${c.best.term}” in Keywords`}
                      >
                        <span className="truncate">{c.best.term}</span>
                        <span className="text-subtle shrink-0 tabular-nums">{formatPosition(c.best.position)}</span>
                      </Link>
                    ) : c.keywords ? (
                      <span className="text-subtle">not ranked yet</span>
                    ) : (
                      <Link href={`/apps/${appId}/keywords`} onClick={(e) => e.stopPropagation()} className="text-subtle hover:text-foreground">
                        Track keywords
                      </Link>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-subtle py-6 text-center">No country data yet. It appears once Apple, PostHog or your tracked keywords report a country.</p>
      )}
      {rows.length > LIMIT && (
        <button type="button" onClick={() => setAll((v) => !v)} className="caption-style text-soft hover:text-foreground cursor-pointer self-start">
          {all ? "Show fewer" : `Show all ${rows.length} countries`}
        </button>
      )}
    </Panel>
  );
}
