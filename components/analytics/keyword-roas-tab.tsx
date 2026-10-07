"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import type { KeywordRoasResult, KeywordRoasRow } from "@/lib/analytics/types";
import { formatCompact, formatMoney, formatPercent } from "@/lib/client/format";
import { cn } from "@/lib/utils";
import { Panel } from "./chart-kit";
import { DemoBanner, ErrorBlock, KpiTile, LoadingBlock, RoasTag } from "./parts";
import KeywordTrendSheet from "./keyword-trend-sheet";
import { useAnalytics, type AnalyticsFilterState } from "./use-analytics";

type SortKey = "keyword" | "spend" | "installs" | "trials" | "revenue" | "cpi" | "trialRate" | "roas";

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "keyword", label: "Keyword" },
  { key: "spend", label: "Spend", align: "right" },
  { key: "installs", label: "Installs", align: "right" },
  { key: "cpi", label: "CPI", align: "right" },
  { key: "trials", label: "Trials", align: "right" },
  { key: "trialRate", label: "Trial rate", align: "right" },
  { key: "revenue", label: "Revenue", align: "right" },
  { key: "roas", label: "ROAS", align: "right" },
];

function sortValue(row: KeywordRoasRow, key: SortKey) {
  if (key === "keyword") return (row.keyword ?? row.keywordId).toLowerCase();
  return row[key] ?? -Infinity;
}

export default function KeywordRoasTab({ filters }: { filters: AnalyticsFilterState }) {
  const { data, error } = useAnalytics<KeywordRoasResult>("keywords", filters);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "spend", dir: -1 });
  const [open, setOpen] = useState<KeywordRoasRow | null>(null);
  const rows = useMemo(() => {
    const list = [...(data?.keywords ?? [])];
    return list.sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    });
  }, [data, sort]);
  if (error) return <ErrorBlock message={error.message} />;
  if (!data) return <LoadingBlock />;
  const money = (v: number | null) => (v == null ? "—" : formatMoney(v, data.currency === "MIXED" ? "USD" : data.currency));
  const t = data.totals;

  return (
    <div className="flex flex-col gap-4">
      <DemoBanner notice={data.notice} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiTile label="Ad spend" value={money(t.spend)} />
        <KpiTile label="Attributed installs" value={formatCompact(t.installs)} hint="Installs the SDK attributed to a keyword via AdServices" />
        <KpiTile label="CPI" value={money(t.cpi)} />
        <KpiTile label="Trials" value={formatCompact(t.trials)} />
        <KpiTile label="Cohort revenue" value={formatMoney(t.revenue)} hint="All revenue from users who installed in this period, through today" />
        <KpiTile label="ROAS" value={t.roas == null ? "—" : `${t.roas.toFixed(2)}×`} />
      </div>
      {data.currency !== "USD" && (
        <p className="caption-style text-warning">Apple Ads spend is reported in {data.currency === "MIXED" ? "multiple currencies" : data.currency}; revenue is in USD, so ROAS is approximate.</p>
      )}
      <Panel
        title="Keywords"
        description="Spend from Apple Ads reports joined to SDK-attributed installs and their RevenueCat/Superwall revenue. Select a keyword for its daily trend."
      >
        <div className="-mx-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {COLUMNS.map((col, i) => (
                  <TableHead key={col.key} className={cn(col.align === "right" && "text-right", i === 0 && "pl-4")} aria-sort={sort.key === col.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
                    <button
                      type="button"
                      className={cn("hover:text-soft inline-flex cursor-pointer items-center gap-1", sort.key === col.key && "text-foreground")}
                      onClick={() => setSort((s) => ({ key: col.key, dir: s.key === col.key ? (s.dir === 1 ? -1 : 1) : col.key === "keyword" ? 1 : -1 }))}
                    >
                      {col.label}
                      {sort.key === col.key && (sort.dir === 1 ? <ArrowUp aria-hidden className="size-3" /> : <ArrowDown aria-hidden className="size-3" />)}
                    </button>
                  </TableHead>
                ))}
                <TableHead className="w-8 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.keywordId} className="cursor-pointer hover:bg-white/3" onClick={() => setOpen(row)}>
                  <TableCell className="pl-4">
                    <span className="flex flex-col gap-1">
                      <span>{row.keyword ?? <span className="text-subtle">Keyword {row.keywordId}</span>}</span>
                      {row.campaignId && <span className="caption-style text-subtle">Campaign {row.campaignId}</span>}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{money(row.spend)}</TableCell>
                  <TableCell className="text-right tabular-nums" title={`${row.adsInstalls} installs reported by Apple Ads`}>
                    {formatCompact(row.installs)}
                    {row.adsInstalls > 0 && <span className="caption-style text-subtle"> / {formatCompact(row.adsInstalls)}</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{money(row.cpi)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCompact(row.trials)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPercent(row.trialRate)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(row.revenue)}</TableCell>
                  <TableCell className="text-right">
                    <RoasTag roas={row.roas} />
                  </TableCell>
                  <TableCell className="pr-4">
                    <ChevronRight aria-hidden className="text-subtle size-4" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!rows.length && <p className="text-subtle px-4 py-6">No keyword spend or attributed installs in this period. Connect Apple Ads and the SDK to fill this table.</p>}
        </div>
        <p className="caption-style text-subtle">Installs show SDK-attributed / Apple Ads-reported. CPI falls back to Apple-reported installs when the SDK has none.</p>
      </Panel>
      <KeywordTrendSheet row={open} filters={filters} currency={data.currency} onClose={() => setOpen(null)} />
    </div>
  );
}
