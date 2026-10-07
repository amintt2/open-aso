"use client";

import { Info } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/_ui/table";
import type { RetentionResult } from "@/lib/analytics/types";
import { formatCompact, formatPercent } from "@/lib/client/format";
import { Panel, shortDate } from "./chart-kit";
import { DemoBanner, ErrorBlock, KpiTile, LoadingBlock } from "./parts";
import { useAnalytics, type AnalyticsFilterState } from "./use-analytics";

function HeatCell({
  value,
  eligible,
}: {
  value: number | null;
  eligible: number;
}) {
  if (value == null)
    return <TableCell className="text-subtle text-center">—</TableCell>;
  const alpha = 0.08 + Math.min(1, value / 0.6) * 0.62;
  return (
    <TableCell className="p-1">
      <span
        className="flex h-[34px] items-center justify-center rounded-md tabular-nums"
        style={{ background: `rgba(57, 135, 229, ${alpha.toFixed(3)})` }}
        title={`${eligible} eligible users`}
      >
        {formatPercent(value)}
      </span>
    </TableCell>
  );
}

export default function RetentionTab({
  filters,
}: {
  filters: AnalyticsFilterState;
}) {
  const { data, error } = useAnalytics<RetentionResult>("retention", filters);
  if (error) return <ErrorBlock message={error.message} />;
  if (!data) return <LoadingBlock />;
  const cohortLabel = (c: string) =>
    data.granularity === "week" ? `Week of ${shortDate(c)}` : shortDate(c);
  return (
    <div className="flex flex-col gap-4">
      <DemoBanner notice={data.notice} />
      <div className="grid grid-cols-3 gap-3">
        <KpiTile
          label="Day 1"
          value={formatPercent(data.average.d1)}
          hint="Share of users active exactly one day after install"
        />
        <KpiTile label="Day 7" value={formatPercent(data.average.d7)} />
        <KpiTile label="Day 30" value={formatPercent(data.average.d30)} />
      </div>
      {!data.demo && data.sessionDays === 0 && (
        <div className="bg-card border-border flex items-center gap-2 rounded-xl border px-4 py-3">
          <Info aria-hidden className="text-soft size-4 shrink-0" />
          <p className="text-soft">
            No session pings yet. Call /api/attribution/event on every app open
            (the SDK snippets do this) to compute retention.
          </p>
        </div>
      )}
      <Panel
        title="Install cohorts"
        description={`Users who opened the app exactly N days after install, ${data.granularity === "week" ? "grouped by install week" : "by install day"}. Cohorts that are too young show —.`}
      >
        <div className="-mx-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Cohort</TableHead>
                <TableHead className="text-right">Installs</TableHead>
                <TableHead className="w-[120px] text-center">D1</TableHead>
                <TableHead className="w-[120px] text-center">D7</TableHead>
                <TableHead className="w-[120px] pr-4 text-center">
                  D30
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.cohorts.map((c) => (
                <TableRow key={c.cohort}>
                  <TableCell className="pl-4">
                    {cohortLabel(c.cohort)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCompact(c.installs)}
                  </TableCell>
                  <HeatCell value={c.d1} eligible={c.eligible.d1} />
                  <HeatCell value={c.d7} eligible={c.eligible.d7} />
                  <HeatCell value={c.d30} eligible={c.eligible.d30} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!data.cohorts.length && (
            <p className="text-subtle px-4 py-6">No installs in this period.</p>
          )}
        </div>
        {data.days < 30 && (
          <p className="caption-style text-subtle">
            D30 needs installs older than 30 days — switch to the 90-day period
            to see it.
          </p>
        )}
      </Panel>
    </div>
  );
}
