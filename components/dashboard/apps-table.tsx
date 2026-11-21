"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, Plus } from "lucide-react";
import Button from "@/components/_ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { SourceChip, type KpiSource } from "@/components/analytics/parts";
import AppIcon from "@/components/shell/app-icon";
import { approxInstalls, formatReach } from "@/components/trends/trends-format";
import { useApi } from "@/lib/client/api";
import { formatCompact, formatUsd } from "@/lib/client/format";
import type { AppsResult, DashboardApp, Period } from "@/lib/dashboard/types";
import { useUiStore } from "@/stores/ui-store";
import { Flags, PctDelta } from "./parts";
import Sparkline from "./sparkline";
import { Skeleton, WidgetError } from "./widget";

const COLUMNS: { label: string; source: KpiSource; hint: string }[] = [
  { label: "First-time downloads · 7d", source: "apple", hint: "People who downloaded the app for the first time in the last 7 days of Apple data. The reference for new installs." },
  { label: "First opens · 7d", source: "posthog", hint: "Devices that sent the first-open event to PostHog in the last 7 days. Includes TestFlight and App Review devices, so it can run above Apple's downloads." },
  { label: "Net revenue · 7d", source: "revenue", hint: "Revenue after refunds over the last 7 days, in USD, from RevenueCat or Superwall." },
  { label: "Keywords in top 10", source: "measured", hint: "Tracked keywords where the app ranks 1 to 10 in App Store search today, out of all tracked keywords." },
  { label: "Est. search installs / day", source: "estimate", hint: "Installs per day the rankings model expects from the app's current ranks, 7-day average, with the last 30 days as a sparkline." },
];

function warningText(app: DashboardApp) {
  const w = app.warnings;
  return [
    w.unrelated > 0 && `${w.unrelated} unrelated keywords`,
    w.wrongLanguage > 0 && `${w.wrongLanguage} keywords in the wrong language`,
    w.stale > 0 && `${w.stale} keywords not refreshed in 48 hours`,
    w.ascNotLinked && "not linked to App Store Connect",
    w.detectionNeverRun && "keyword detection never ran",
  ].filter((x): x is string => !!x);
}

function Cell({ href, children, title }: { href: string; children: ReactNode; title?: string }) {
  return (
    <TableCell className="h-auto p-0 text-right">
      <Link href={href} title={title} className="hover:bg-white/4 focus-visible:ring-ring/60 flex min-h-[56px] flex-col items-end justify-center gap-1 px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-inset">
        {children}
      </Link>
    </TableCell>
  );
}

function Metric({ period, format, missing, own }: { period: Period | null; format: (n: number) => string; missing: string; own: boolean }) {
  if (!period)
    return (
      <span className="caption-style text-subtle" title={own ? undefined : "Only available for your own apps"}>
        {own ? missing : "not your app"}
      </span>
    );
  return (
    <>
      <span className="text-[15px] leading-none font-medium tabular-nums">{format(period.current)}</span>
      <PctDelta period={period} suffix="" />
    </>
  );
}

function Row({ app }: { app: DashboardApp }) {
  const base = `/apps/${app.id}`;
  const warnings = warningText(app);
  return (
    <TableRow>
      <TableCell className="h-auto p-0">
        <Link href={base} className="hover:bg-white/4 focus-visible:ring-ring/60 flex min-h-[56px] min-w-0 items-center gap-3 px-4 py-2 outline-none focus-visible:ring-2 focus-visible:ring-inset">
          <AppIcon src={app.iconUrl} name={app.name} className="size-8" />
          <span className="flex min-w-0 flex-col gap-1">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[14px] font-medium">{app.name}</span>
              {warnings.length > 0 && (
                <span className="caption-style inline-flex shrink-0 items-center gap-1 text-(--tag-amber-text)" title={warnings.join(" · ")}>
                  <AlertTriangle aria-hidden className="size-3" />
                  {warnings.length}
                </span>
              )}
            </span>
            <span className="caption-style text-subtle flex min-w-0 items-center gap-2">
              <span className="shrink-0">{app.keywordCount} keywords</span>
              <Flags codes={app.countries} max={4} />
            </span>
          </span>
        </Link>
      </TableCell>
      <Cell href={`${base}/traffic`} title={app.downloads?.dataThrough ? `Apple data through ${app.downloads.dataThrough}` : undefined}>
        <Metric period={app.downloads} format={formatCompact} missing="Connect App Store Connect" own={app.isMine} />
      </Cell>
      <Cell href={`${base}/traffic?view=funnel`}>
        <Metric period={app.firstOpens} format={formatCompact} missing="Connect PostHog" own={app.isMine} />
      </Cell>
      <Cell href={`${base}/traffic?view=revenue`}>
        <Metric period={app.revenue} format={formatUsd} missing="Connect RevenueCat" own={app.isMine} />
      </Cell>
      <Cell href={`${base}/keywords`}>
        {app.tracked ? (
          <>
            <span className="text-[15px] leading-none font-medium tabular-nums">
              {app.top10} <span className="text-subtle font-normal">/ {app.tracked}</span>
            </span>
            <span className="caption-style text-subtle tabular-nums">{app.top3} in top 3</span>
          </>
        ) : (
          <span className="caption-style text-subtle">No keywords yet</span>
        )}
      </Cell>
      <TableCell className="h-auto p-0">
        <Link href={`${base}/trends`} title={`Search reach ${formatReach(app.searchReach)}: share of the installs available on the keywords in the app's metadata`} className="hover:bg-white/4 focus-visible:ring-ring/60 flex min-h-[56px] items-center justify-end gap-3 py-2 pr-4 pl-3 outline-none focus-visible:ring-2 focus-visible:ring-inset">
          <Sparkline values={app.series.map((p) => p.installs)} className="h-7 w-[96px]" label={`${app.name} estimated search installs over 30 days`} />
          <span className="flex w-[84px] flex-col items-end gap-1">
            <span className="text-[15px] leading-none font-medium tabular-nums">{approxInstalls(app.searchInstalls?.current)}</span>
            {app.searchInstalls && <PctDelta period={app.searchInstalls} suffix="" />}
          </span>
        </Link>
      </TableCell>
    </TableRow>
  );
}

function total(apps: DashboardApp[], pick: (a: DashboardApp) => Period | null) {
  const values = apps.map(pick).filter((p): p is Period => !!p);
  return values.length ? values.reduce((s, p) => s + p.current, 0) : null;
}

export default function AppsTable() {
  const { data, error } = useApi<AppsResult>("/api/dashboard/apps");
  const setAddAppOpen = useUiStore((s) => s.setAddAppOpen);
  if (error && !data) return <WidgetError message={error.message} />;
  const apps = data?.apps ?? [];
  const downloads = total(apps, (a) => a.downloads);
  const opens = total(apps, (a) => a.firstOpens);
  const revenue = total(apps, (a) => a.revenue);
  const search = total(apps, (a) => a.searchInstalls);
  return (
    <section className="bg-card border-border overflow-hidden rounded-xl border">
      <div className="overflow-x-auto">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">App</TableHead>
              {COLUMNS.map((c) => (
                <TableHead key={c.label} className="h-auto py-2 text-right last:pr-4" title={c.hint}>
                  <span className="inline-flex flex-col items-end gap-1">
                    {c.label}
                    <SourceChip source={c.source} />
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data
              ? apps.map((app) => <Row key={app.id} app={app} />)
              : [0, 1, 2].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6} className="px-4">
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
            {apps.length > 1 && (
              <TableRow className="border-b-0">
                <TableCell className="text-subtle caption-style pl-4">All {apps.length} apps</TableCell>
                <TableCell className="text-right tabular-nums">{downloads == null ? "—" : formatCompact(downloads)}</TableCell>
                <TableCell className="text-right tabular-nums">{opens == null ? "—" : formatCompact(opens)}</TableCell>
                <TableCell className="text-right tabular-nums">{revenue == null ? "—" : formatUsd(revenue)}</TableCell>
                <TableCell className="text-right tabular-nums">{apps.reduce((s, a) => s + a.top10, 0)}</TableCell>
                <TableCell className="pr-4 text-right tabular-nums">{approxInstalls(search)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="border-border flex items-center justify-between gap-3 border-t px-4 py-2">
        <span className="caption-style text-subtle">Each number opens the page it comes from. Deltas compare with the 7 days before.</span>
        <Button variant="ghost" size="sm" onClick={() => setAddAppOpen(true)}>
          <Plus aria-hidden className="size-3.5" />
          Add app
        </Button>
      </div>
    </section>
  );
}
