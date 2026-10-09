"use client";

import { Panel } from "@/components/analytics/chart-kit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import type { SyncInfo, SyncLogEntry } from "@/lib/asc/analytics/types";
import { formatCompact, timeAgo } from "@/lib/client/format";
import { cn } from "@/lib/utils";
import { formatDay, formatUtcMinute, formatWhen } from "./format";

const OUTCOME: Record<SyncLogEntry["outcome"], { label: string; tone: string }> = {
  "new-data": { label: "New data", tone: "text-trend" },
  "no-new-data": { label: "Nothing new yet", tone: "text-soft" },
  "up-to-date": { label: "Already up to date", tone: "text-subtle" },
  waiting: { label: "Waiting for Apple", tone: "text-soft" },
  error: { label: "Error", tone: "text-danger" },
};

export default function SyncActivity({ sync }: { sync: SyncInfo }) {
  const usual = formatUtcMinute(sync.publishMinuteUtc);
  const facts = [
    { label: "Last check", value: sync.lastCheckAt ? timeAgo(sync.lastCheckAt) : "never" },
    { label: "Next check", value: sync.nextCheckAt ? `~${formatWhen(sync.nextCheckAt)}` : "—" },
    { label: "Newest Apple report", value: formatDay(sync.lastProcessingDate) },
    { label: "Usual publish time", value: usual ?? "learning…" },
    { label: "API calls today", value: `${formatCompact(sync.apiCallsToday)} app · ${formatCompact(sync.workspaceCallsToday)} workspace` },
    { label: "History snapshot", value: sync.snapshot === "done" ? "Imported" : sync.snapshot === "pending" ? "Pending" : "Not available" },
  ];
  return (
    <Panel title="Sync activity" description="One cheap check per hour inside the publish window, nothing once yesterday's numbers are in. Report requests are reused, never duplicated.">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3 xl:grid-cols-6">
        {facts.map((f) => (
          <div key={f.label} className="flex min-w-0 flex-col gap-1.5">
            <dt className="caption-style text-subtle">{f.label}</dt>
            <dd className="break-words tabular-nums">{f.value}</dd>
          </div>
        ))}
      </dl>
      {sync.log.length > 0 && (
        <div className="-mx-4 overflow-x-auto px-4">
          <Table className="min-w-[560px]">
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Result</TableHead>
                <TableHead className="text-right">API calls</TableHead>
                <TableHead className="text-right">Reports</TableHead>
                <TableHead className="text-right">Rows</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sync.log.slice(0, 8).map((e) => (
                <TableRow key={`${e.at}-${e.trigger}`}>
                  <TableCell className="whitespace-nowrap">{timeAgo(e.at)}</TableCell>
                  <TableCell className="text-soft capitalize">{e.trigger}</TableCell>
                  <TableCell className={cn("max-w-[360px] truncate", OUTCOME[e.outcome].tone)} title={e.message}>
                    {OUTCOME[e.outcome].label}
                    {e.message && e.outcome === "error" ? ` · ${e.message}` : ""}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{e.calls}</TableCell>
                  <TableCell className="text-right tabular-nums">{e.instances}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCompact(e.rows)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Panel>
  );
}
