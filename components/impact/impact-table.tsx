"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Checkbox } from "@/components/_ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import Tag from "@/components/_ui/tag";
import { Panel } from "@/components/analytics/chart-kit";
import { PositionBadge } from "@/components/shell/score";
import { formatPercent } from "@/lib/client/format";
import type { Confidence, ImpactKeyword, ImpactResult } from "@/lib/impact/types";
import { cn } from "@/lib/utils";
import { countryName, flagOf, formatEstimate, formatEstimateUsd } from "./impact-format";

type SortKey = "term" | "country" | "position" | "popularity" | "estDownloads" | "shareOfSearch" | "estRevenue" | "paidInstalls" | "confidence";

const CONFIDENCE_RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1 };
const CONFIDENCE_TONE = { high: "green", medium: "amber", low: "neutral" } as const;

function sortValue(row: ImpactKeyword, key: SortKey): number | string {
  if (key === "term") return row.term;
  if (key === "country") return row.country;
  if (key === "confidence") return CONFIDENCE_RANK[row.confidence];
  if (key === "position") return row.position == null || row.position <= 0 ? Infinity : row.position;
  return row[key] ?? -Infinity;
}

function PopularityBadge({ value, source }: { value: number | null; source: ImpactKeyword["popularitySource"] }) {
  if (value == null) return <span className="text-subtle">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      {Math.round(value)}
      <Tag tone={source === "apple" ? "blue" : "neutral"} size="sm" className="h-[18px] text-[11px]" title={source === "apple" ? "Apple Search Ads popularity" : "Modelled from App Store search hints"}>
        {source === "apple" ? "Apple" : "est."}
      </Tag>
    </span>
  );
}

export default function ImpactTable({ data }: { data: ImpactResult }) {
  const [liveOnly, setLiveOnly] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "estDownloads", dir: -1 });
  const multiCountry = data.country === "all";
  const columns: { key: SortKey; label: string; align?: "right"; hidden?: boolean; hint?: string }[] = [
    { key: "term", label: "Keyword" },
    { key: "country", label: "Country", hidden: !multiCountry },
    { key: "position", label: "Rank", align: "right" },
    { key: "popularity", label: "Popularity", align: "right" },
    { key: "estDownloads", label: `Est. installs (${data.days}d)`, align: "right", hint: "Modelled estimate over the window" },
    { key: "shareOfSearch", label: data.calibrated ? "% of search" : "% of tracked", align: "right", hint: data.calibrated ? "Share of the country's estimated search installs" : "Share of the estimate across tracked keywords" },
    { key: "estRevenue", label: "Est. revenue", align: "right", hidden: !data.revenueAvailable },
    { key: "paidInstalls", label: "Paid installs", align: "right", hint: "Apple Ads installs for this keyword" },
    { key: "confidence", label: "Confidence", align: "right" },
  ];
  const visible = columns.filter((c) => !c.hidden);
  const hiddenCount = data.keywords.filter((k) => !k.live).length;
  const rows = useMemo(() => {
    const list = data.keywords.filter((k) => !liveOnly || k.live);
    return list.sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    });
  }, [data.keywords, liveOnly, sort]);

  return (
    <Panel
      title="Keywords"
      description="Modelled installs and revenue per tracked keyword. Live = ranked in the top 50 or getting Apple Ads installs."
      actions={
        <label className="caption-style text-soft flex cursor-pointer items-center gap-1.5">
          <Checkbox checked={liveOnly} onCheckedChange={(c) => setLiveOnly(c === true)} aria-label="Live keywords only" />
          Live only{hiddenCount > 0 && liveOnly ? ` (${hiddenCount} hidden)` : ""}
        </label>
      }
    >
      <div className="-mx-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {visible.map((col, i) => (
                <TableHead
                  key={col.key}
                  className={cn(col.align === "right" && "text-right", i === 0 && "pl-4", i === visible.length - 1 && "pr-4")}
                  aria-sort={sort.key === col.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}
                  title={col.hint}
                >
                  <button
                    type="button"
                    className={cn("hover:text-soft inline-flex cursor-pointer items-center gap-1", sort.key === col.key && "text-foreground")}
                    onClick={() =>
                      setSort((s) => ({
                        key: col.key,
                        dir: s.key === col.key ? (s.dir === 1 ? -1 : 1) : col.key === "term" || col.key === "country" || col.key === "position" ? 1 : -1,
                      }))
                    }
                  >
                    {col.label}
                    {sort.key === col.key && (sort.dir === 1 ? <ArrowUp aria-hidden className="size-3" /> : <ArrowDown aria-hidden className="size-3" />)}
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key} className={cn(!row.live && "text-subtle")}>
                <TableCell className="pl-4">
                  <span className="flex flex-col gap-1">
                    <span className={cn(row.live && "text-foreground")}>{row.term}</span>
                    {!row.live && <span className="caption-style text-subtle">Not ranked in the top 50 — no search installs expected</span>}
                  </span>
                </TableCell>
                {multiCountry && (
                  <TableCell title={countryName(row.country)}>
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden>{flagOf(row.country)}</span>
                      <span className="caption-style uppercase">{row.country}</span>
                    </span>
                  </TableCell>
                )}
                <TableCell className="text-right">
                  <PositionBadge position={row.position != null && row.position > 0 ? row.position : null} change={row.positionStart != null && row.position != null ? row.positionStart - row.position : null} />
                </TableCell>
                <TableCell className="text-right">
                  <PopularityBadge value={row.popularity} source={row.popularitySource} />
                </TableCell>
                <TableCell className="text-right tabular-nums" title={`≈ ${formatEstimate(row.estPerDay)} per day`}>
                  <span className="flex flex-col items-end gap-1">
                    <span className={cn(row.live && "text-foreground")}>~{formatEstimate(row.estDownloads)}</span>
                    <span className="caption-style text-subtle">{formatEstimate(row.estPerDay)}/day</span>
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatPercent(row.shareOfSearch)}</TableCell>
                {data.revenueAvailable && <TableCell className="text-right tabular-nums">~{formatEstimateUsd(row.estRevenue)}</TableCell>}
                <TableCell className="text-right tabular-nums">
                  {row.paidInstalls > 0 ? (
                    <span className="flex flex-col items-end gap-1" title={row.paidRevenueSource === "attributed" ? "Revenue attributed by the SDK to installs from this keyword" : row.paidRevenueSource === "modelled" ? "Revenue modelled from paid installs × ARPU" : undefined}>
                      <span>{formatEstimate(row.paidInstalls)}</span>
                      {row.paidRevenue != null && (
                        <span className="caption-style text-subtle">
                          {formatEstimateUsd(row.paidRevenue)} {row.paidRevenueSource === "attributed" ? "attributed" : "modelled"}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-subtle">—</span>
                  )}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <Tag tone={CONFIDENCE_TONE[row.confidence]} size="sm" className="text-[12px] capitalize" title={row.confidenceReasons.join(" · ") || "Plenty of observed installs, stable rank and Apple popularity"}>
                    {row.confidence}
                  </Tag>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={visible.length} className="text-subtle h-[96px] text-center whitespace-normal">
                  {data.keywords.length
                    ? "None of your tracked keywords rank in the top 50 here. Untick “Live only” to see them all."
                    : "No tracked keywords in this scope. Add keywords on the Keywords page to see their impact."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}
