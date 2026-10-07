"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { Panel, shortDate } from "@/components/analytics/chart-kit";
import { KpiTile } from "@/components/analytics/parts";
import { formatCompact, formatPercent } from "@/lib/client/format";
import type { PosthogRetentionResult } from "@/lib/posthog/types";
import { MissingRoles, scopeLabel } from "./product-parts";
import { usePosthogView, type ProductTarget } from "./use-posthog";
import ViewFrame from "./view-frame";

function HeatCell({ value, eligible }: { value: number | null; eligible: number }) {
  if (value == null) return <TableCell className="text-subtle text-center">—</TableCell>;
  const alpha = 0.08 + Math.min(1, value / 0.6) * 0.62;
  return (
    <TableCell className="p-1">
      <span className="flex h-[34px] items-center justify-center rounded-md tabular-nums" style={{ background: `rgba(57, 135, 229, ${alpha.toFixed(3)})` }} title={`${eligible} eligible users`}>
        {formatPercent(value)}
      </span>
    </TableCell>
  );
}

export default function ProductRetention({ target, onConnect }: { target: ProductTarget; onConnect: () => void }) {
  const view = usePosthogView<PosthogRetentionResult>("retention", target);
  return (
    <ViewFrame {...view} onConnect={onConnect} caption={scopeLabel}>
      {(data) => (
        <>
          <MissingRoles roles={data.missing}>{data.activity === "any" ? "Retention falls back to any event as activity." : undefined}</MissingRoles>
          <div className="grid grid-cols-3 gap-3">
            <KpiTile label="Day 1" value={formatPercent(data.average.d1)} hint="Share of new users who opened the app exactly one day after their first open" />
            <KpiTile label="Day 7" value={formatPercent(data.average.d7)} />
            <KpiTile label="Day 30" value={formatPercent(data.average.d30)} />
          </div>
          <Panel
            title="First-open cohorts"
            description={`People who ${data.activity === "open" ? "fired an app-open event" : "sent any event"} exactly N days after their first open, ${data.granularity === "week" ? "grouped by first-open week" : "by first-open day"}. Cohorts that are too young show —.`}
          >
            <div className="-mx-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Cohort</TableHead>
                    <TableHead className="text-right">New users</TableHead>
                    <TableHead className="w-[120px] text-center">D1</TableHead>
                    <TableHead className="w-[120px] text-center">D7</TableHead>
                    <TableHead className="w-[120px] pr-4 text-center">D30</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.cohorts.map((c) => (
                    <TableRow key={c.cohort}>
                      <TableCell className="pl-4">{data.granularity === "week" ? `Week of ${shortDate(c.cohort)}` : shortDate(c.cohort)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCompact(c.users)}</TableCell>
                      <HeatCell value={c.d1} eligible={c.eligible.d1} />
                      <HeatCell value={c.d7} eligible={c.eligible.d7} />
                      <HeatCell value={c.d30} eligible={c.eligible.d30} />
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!data.cohorts.length && <p className="text-subtle px-4 py-6">No first-open events in this period.</p>}
            </div>
            {data.days < 30 && <p className="caption-style text-subtle">D30 needs cohorts older than 30 days — switch to the 90-day period to see it.</p>}
          </Panel>
        </>
      )}
    </ViewFrame>
  );
}
