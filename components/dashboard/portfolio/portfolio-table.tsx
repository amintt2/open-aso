"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { SourceChip, type KpiSource } from "@/components/analytics/parts";
import AppIcon from "@/components/shell/app-icon";
import { approxInstalls } from "@/components/trends/trends-format";
import { formatCompact, formatPercent, formatUsd } from "@/lib/client/format";
import type { PortfolioApp, PortfolioResult, PortfolioValue } from "@/lib/dashboard/portfolio-types";
import { cn } from "@/lib/utils";
import Sparkline from "../sparkline";
import { appColor, appHref, change } from "./portfolio-format";

type SortKey = "name" | "impressions" | "conversion" | "downloads" | "firstOpens" | "revenue" | "top10" | "estPerDay";

type Column = { key: Exclude<SortKey, "name">; label: string; source: KpiSource; hint: string; path: string; missing: string };

const COLUMNS: Column[] = [
  { key: "impressions", label: "Impressions", source: "apple", hint: "Times the app was shown on the App Store in the period", path: "/traffic", missing: "Connect ASC" },
  { key: "conversion", label: "Conversion", source: "apple", hint: "First-time downloads ÷ impressions in the period", path: "/traffic", missing: "—" },
  { key: "downloads", label: "First-time downloads", source: "apple", hint: "First-time downloads in the period, with the daily trend", path: "/traffic", missing: "Connect ASC" },
  { key: "firstOpens", label: "First opens", source: "posthog", hint: "First-open events in the period, counted by PostHog", path: "/traffic?view=funnel", missing: "Connect PostHog" },
  { key: "revenue", label: "Net revenue", source: "revenue", hint: "Revenue after refunds in the period, in USD", path: "/traffic?view=revenue", missing: "Connect RevenueCat" },
  { key: "top10", label: "Keywords in top 10", source: "measured", hint: "Tracked keywords ranked 1 to 10 today, out of all tracked keywords", path: "/keywords", missing: "No keywords" },
  { key: "estPerDay", label: "Est. search installs / day", source: "estimate", hint: "Installs per day the rankings model expects, 7-day average", path: "/trends", missing: "—" },
];

function valueOf(app: PortfolioApp, key: SortKey): number | string | null {
  if (key === "name") return app.name.toLowerCase();
  if (key === "conversion") return app.conversion.value;
  if (key === "top10") return app.keywords ? app.top10 : null;
  if (key === "estPerDay") return app.estPerDay;
  return app.steps[key].value;
}

function Delta({ v, points = false }: { v: PortfolioValue; points?: boolean }) {
  if (points) {
    if (v.value == null || v.previous == null) return null;
    const d = (v.value - v.previous) * 100;
    return <span className={cn("caption-style tabular-nums", Math.abs(d) < 0.005 ? "text-subtle" : d > 0 ? "text-trend" : "text-danger")}>{d > 0 ? "▲" : d < 0 ? "▼" : ""} {Math.abs(d).toFixed(2)} pts</span>;
  }
  const d = change(v);
  if (d == null) return <span className="caption-style text-subtle">no prior data</span>;
  return <span className={cn("caption-style tabular-nums", Math.abs(d) < 0.005 ? "text-subtle" : d > 0 ? "text-trend" : "text-danger")}>{d > 0 ? "▲" : d < 0 ? "▼" : ""} {Math.abs(d * 100).toFixed(0)}%</span>;
}

function Cell({ href, children, className }: { href: string | null; children: ReactNode; className?: string }) {
  const inner = cn("flex min-h-[56px] flex-col items-end justify-center gap-1 px-3 py-2", className);
  return (
    <TableCell className="h-auto p-0 text-right">
      {href ? (
        <Link href={href} className={cn(inner, "hover:bg-white/4 focus-visible:ring-ring/60 outline-none focus-visible:ring-2 focus-visible:ring-inset")}>
          {children}
        </Link>
      ) : (
        <span className={inner}>{children}</span>
      )}
    </TableCell>
  );
}

const big = "text-[15px] leading-none font-medium tabular-nums";

function metricCell(app: PortfolioApp, c: Column, color: string) {
  if (c.key === "conversion") return app.conversion.value == null ? <span className="caption-style text-subtle">{c.missing}</span> : <><span className={big}>{formatPercent(app.conversion.value, 2)}</span><Delta v={app.conversion} points /></>;
  if (c.key === "top10") return app.keywords ? <><span className={big}>{app.top10} <span className="text-subtle font-normal">/ {app.keywords}</span></span><span className="caption-style text-subtle">today</span></> : <span className="caption-style text-subtle">{c.missing}</span>;
  if (c.key === "estPerDay") return app.estPerDay == null ? <span className="caption-style text-subtle">{c.missing}</span> : <><span className={big}>{approxInstalls(app.estPerDay)}</span><span className="caption-style text-subtle">reach {app.reach == null ? "—" : `${app.reach.toFixed(1)}%`}</span></>;
  const v = app.steps[c.key];
  if (v.value == null) return <span className="caption-style text-subtle">{c.missing}</span>;
  const text = c.key === "revenue" ? formatUsd(v.value) : formatCompact(v.value);
  if (c.key !== "downloads") return <><span className={big}>{text}</span><Delta v={v} /></>;
  return (
    <span className="flex items-center gap-3">
      <Sparkline values={app.series.downloads} color={color} className="h-7 w-[72px]" label={`${app.name} first-time downloads per day`} />
      <span className="flex flex-col items-end gap-1">
        <span className={big}>{text}</span>
        <Delta v={v} />
      </span>
    </span>
  );
}

export default function PortfolioTable({ data }: { data: PortfolioResult }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "downloads", dir: -1 });
  const colors = useMemo(() => new Map(data.apps.map((a, i) => [a.key, appColor(i)])), [data.apps]);
  const rows = useMemo(
    () =>
      [...data.apps].sort((a, b) => {
        const va = valueOf(a, sort.key);
        const vb = valueOf(b, sort.key);
        if (va == null || vb == null) return va == null && vb == null ? 0 : va == null ? 1 : -1;
        return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
      }),
    [data.apps, sort],
  );
  const head = (key: SortKey, label: ReactNode, hint: string) => (
    <button
      type="button"
      title={`${hint}. Click to sort.`}
      onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "name" ? 1 : -1 }))}
      className={cn("focus-visible:ring-ring/60 inline-flex cursor-pointer flex-col items-end gap-1 rounded outline-none focus-visible:ring-2", sort.key === key ? "text-foreground" : "hover:text-soft")}
    >
      {label}
    </button>
  );
  const total = (key: "impressions" | "downloads" | "firstOpens" | "revenue") => data.steps.find((s) => s.key === key);
  const sumOf = (pick: (a: PortfolioApp) => number | null) => {
    const values = data.apps.map(pick).filter((n): n is number => n != null);
    return values.length ? values.reduce((s, n) => s + n, 0) : null;
  };
  const impressions = total("impressions");
  const downloads = total("downloads");
  const overall: PortfolioValue = {
    value: impressions?.value && downloads?.value != null ? downloads.value / impressions.value : null,
    previous: impressions?.previous && downloads?.previous != null ? downloads.previous / impressions.previous : null,
  };
  const totalCell = (v: PortfolioValue | undefined, format: (n: number) => string) =>
    v?.value == null ? <span className="text-faint">—</span> : <span className="flex flex-col items-end gap-1"><span className="tabular-nums">{format(v.value)}</span><Delta v={v} /></span>;

  return (
    <section className="bg-card border-border overflow-hidden rounded-xl border">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-3 pb-1">
        <h2 className="h3-style">Apps compared</h2>
        <span className="caption-style text-subtle">Last {data.days} days · deltas versus the {data.days} days before · each number opens the page it comes from</span>
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[1080px]">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4" aria-sort={sort.key === "name" ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                {head("name", <span>App {sort.key === "name" ? (sort.dir === 1 ? "↑" : "↓") : ""}</span>, "App name")}
              </TableHead>
              {COLUMNS.map((c) => (
                <TableHead key={c.key} className="h-auto py-2 text-right last:pr-4" aria-sort={sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                  {head(
                    c.key,
                    <>
                      <span>
                        {c.label} {sort.key === c.key ? (sort.dir === 1 ? "↑" : "↓") : ""}
                      </span>
                      <SourceChip source={c.source} />
                    </>,
                    c.hint,
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((app) => {
              const color = colors.get(app.key) ?? appColor(0);
              const base = appHref(app);
              const name = (
                <>
                  <span aria-hidden className="h-8 w-1 shrink-0 rounded-full" style={{ background: color }} />
                  <AppIcon src={app.iconUrl} name={app.name} className="size-8" />
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-[14px] font-medium">{app.name}</span>
                    <span className="caption-style text-subtle">{app.keywords} keywords</span>
                  </span>
                </>
              );
              const cls = "flex min-h-[56px] min-w-0 items-center gap-3 py-2 pr-3 pl-4";
              return (
                <TableRow key={app.key}>
                  <TableCell className="h-auto p-0">
                    {base ? (
                      <Link href={base} className={cn(cls, "hover:bg-white/4 focus-visible:ring-ring/60 outline-none focus-visible:ring-2 focus-visible:ring-inset")}>
                        {name}
                      </Link>
                    ) : (
                      <span className={cls}>{name}</span>
                    )}
                  </TableCell>
                  {COLUMNS.map((c, i) => (
                    <Cell key={c.key} href={appHref(app, c.path)} className={i === COLUMNS.length - 1 ? "pr-4" : undefined}>
                      {metricCell(app, c, color)}
                    </Cell>
                  ))}
                </TableRow>
              );
            })}
            <TableRow className="border-b-0">
              <TableCell className="text-subtle caption-style h-[52px] pl-4">{data.apps.length === 1 ? "Total" : `All ${data.apps.length} apps`}</TableCell>
              <TableCell className="text-right">{totalCell(impressions, formatCompact)}</TableCell>
              <TableCell className="text-right">{overall.value == null ? <span className="text-faint">—</span> : <span className="flex flex-col items-end gap-1"><span className="tabular-nums">{formatPercent(overall.value, 2)}</span><Delta v={overall} points /></span>}</TableCell>
              <TableCell className="text-right">{totalCell(downloads, formatCompact)}</TableCell>
              <TableCell className="text-right">{totalCell(total("firstOpens"), formatCompact)}</TableCell>
              <TableCell className="text-right">{totalCell(total("revenue"), formatUsd)}</TableCell>
              <TableCell className="text-right tabular-nums">{sumOf((a) => (a.keywords ? a.top10 : null)) ?? "—"} <span className="text-subtle">/ {sumOf((a) => a.keywords) ?? 0}</span></TableCell>
              <TableCell className="pr-4 text-right tabular-nums">{approxInstalls(sumOf((a) => a.estPerDay))}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
