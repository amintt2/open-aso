"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/_ui/table";
import { Panel, SERIES } from "@/components/analytics/chart-kit";
import { MetricBar } from "@/components/analytics/parts";
import Tag from "@/components/_ui/tag";
import { formatCompact } from "@/lib/client/format";
import type { PosthogVersionsResult } from "@/lib/posthog/types";
import { scopeLabel } from "./product-parts";
import { usePosthogView, type ProductTarget } from "./use-posthog";
import ViewFrame from "./view-frame";

function day(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ProductVersions({
  target,
  onConnect,
}: {
  target: ProductTarget;
  onConnect: () => void;
}) {
  const view = usePosthogView<PosthogVersionsResult>("versions", target);
  return (
    <ViewFrame
      {...view}
      onConnect={onConnect}
      caption={(d) => `${scopeLabel(d)} · $app_version`}
    >
      {(data) => {
        const maxUsers = Math.max(0, ...data.versions.map((v) => v.users));
        const latest = data.versions[0]?.version;
        return (
          <Panel
            title="App versions"
            description="People and events per $app_version. App Store release dates come from the versions Open ASO has seen for this app."
          >
            <div className="-mx-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Version</TableHead>
                    <TableHead>App Store release</TableHead>
                    <TableHead>Seen in period</TableHead>
                    <TableHead className="text-right">Users</TableHead>
                    <TableHead className="w-[140px]" />
                    <TableHead className="text-right">New users</TableHead>
                    <TableHead className="pr-4 text-right">Events</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.versions.map((v) => (
                    <TableRow key={v.version}>
                      <TableCell className="pl-4">
                        <span className="flex items-center gap-2">
                          <span className="font-mono">{v.version}</span>
                          {v.version === latest && (
                            <Tag tone="green" size="sm" className="text-[12px]">
                              Latest
                            </Tag>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-soft">
                        {day(v.releasedAt)}
                      </TableCell>
                      <TableCell className="text-soft whitespace-nowrap">
                        {day(v.firstSeen)} → {day(v.lastSeen)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCompact(v.users)}
                      </TableCell>
                      <TableCell>
                        <MetricBar
                          value={v.users}
                          max={maxUsers}
                          color={SERIES.blue}
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCompact(v.newUsers)}
                      </TableCell>
                      <TableCell className="pr-4 text-right tabular-nums">
                        {formatCompact(v.events)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!data.versions.length && (
                <p className="text-subtle px-4 py-6">
                  No events in this period.
                </p>
              )}
            </div>
          </Panel>
        );
      }}
    </ViewFrame>
  );
}
