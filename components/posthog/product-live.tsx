"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { Panel } from "@/components/analytics/chart-kit";
import { COUNTRY_BY_CODE } from "@/lib/appstore/countries";
import { timeAgo } from "@/lib/client/format";
import type { PosthogEventsResult } from "@/lib/posthog/types";
import { EventName, RoleTag, scopeLabel } from "./product-parts";
import { usePosthogView, type ProductTarget } from "./use-posthog";
import ViewFrame from "./view-frame";

export default function ProductLive({ target, onConnect }: { target: ProductTarget; onConnect: () => void }) {
  const view = usePosthogView<PosthogEventsResult>("events", target);
  return (
    <ViewFrame {...view} onConnect={onConnect} caption={(d) => `${scopeLabel(d).replace(/ · last \d+ days$/, "")} · last 100 events`}>
      {(data) => (
        <Panel title="Live events" description="Most recent events for this app, newest first. Refresh to pull the latest from PostHog.">
          <div className="-mx-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Time</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Person</TableHead>
                  <TableHead>Library</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead className="pr-4">Version</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.events.map((e, i) => (
                  <TableRow key={`${e.timestamp}-${e.event}-${i}`}>
                    <TableCell className="text-soft pl-4 whitespace-nowrap" title={e.timestamp}>
                      {timeAgo(e.timestamp)}
                    </TableCell>
                    <TableCell className="max-w-[320px]">
                      <EventName canonical={e.canonical} raw={e.event} />
                    </TableCell>
                    <TableCell>
                      <RoleTag role={e.role} />
                    </TableCell>
                    <TableCell className="text-soft font-mono text-[12px]">{e.distinctId}</TableCell>
                    <TableCell className="text-soft">{e.lib ?? "—"}</TableCell>
                    <TableCell className="text-soft whitespace-nowrap">{e.country ? `${COUNTRY_BY_CODE.get(e.country)?.flag ?? ""} ${e.country.toUpperCase()}` : "—"}</TableCell>
                    <TableCell className="text-soft pr-4 font-mono">{e.version ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!data.events.length && <p className="text-subtle px-4 py-6">No events in the last 7 days.</p>}
          </div>
        </Panel>
      )}
    </ViewFrame>
  );
}
