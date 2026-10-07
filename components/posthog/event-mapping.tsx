"use client";

import { useState } from "react";
import { toast } from "sonner";
import { mutate } from "swr";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/_ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { api, revalidate, useApi } from "@/lib/client/api";
import { formatCompact } from "@/lib/client/format";
import { defaultRole } from "@/lib/posthog/events";
import { EVENT_ROLES, ROLE_LABELS, type EventCatalogResult, type EventRole, type MappedTrackedApp } from "@/lib/posthog/types";
import { EventName, RoleTag } from "./product-parts";

const OPTION_LIMIT = 200;

function RoleRow({ role, catalog, onChange, busy }: { role: EventRole; catalog: EventCatalogResult; onChange: (role: EventRole, events: string[] | null) => void; busy: boolean }) {
  const resolution = catalog.roles[role];
  const auto = catalog.events.filter((e) => defaultRole(e.event, catalog.app.prefix) === role).map((e) => e.event);
  const value = resolution.source === "auto" ? "auto" : resolution.events.length ? `e:${resolution.events[0]}` : "none";
  const options = catalog.events.slice(0, OPTION_LIMIT);
  const missing = resolution.source === "override" && resolution.events.length > 0 && !options.some((o) => o.event === resolution.events[0]);
  return (
    <div className="grid items-center gap-2 py-2.5 sm:grid-cols-[180px_minmax(0,1fr)]">
      <span className="flex items-center gap-2">
        {ROLE_LABELS[role]}
        {resolution.source === "override" && <span className="caption-style text-subtle">· custom</span>}
      </span>
      <Select
        value={value}
        disabled={busy}
        onValueChange={(v) => onChange(role, v === "auto" ? null : v === "none" ? [] : [v.slice(2)])}
      >
        <SelectTrigger aria-label={`Events for ${ROLE_LABELS[role]}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[320px] overflow-y-auto">
          <SelectItem value="auto">Automatic · {auto.length ? auto.join(", ") : "no match"}</SelectItem>
          <SelectItem value="none">Not tracked</SelectItem>
          {missing && <SelectItem value={value}>{resolution.events[0]} (not seen in 90 days)</SelectItem>}
          {options.map((e) => (
            <SelectItem key={e.event} value={`e:${e.event}`}>
              {e.event} · {formatCompact(e.count)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function AppEvents({ appId }: { appId: number }) {
  const url = `/api/posthog/apps/${appId}/events`;
  const { data, error } = useApi<EventCatalogResult>(url, { shouldRetryOnError: false });
  const [busy, setBusy] = useState(false);
  async function change(role: EventRole, events: string[] | null) {
    setBusy(true);
    try {
      const next = await api<EventCatalogResult>(url, { method: "PUT", body: { role, events } });
      await mutate(url, next, { revalidate: false });
      await revalidate("/api/posthog/");
      toast.success(`${ROLE_LABELS[role]} ${events === null ? "reset to automatic" : "updated"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }
  if (error) return <p className="caption-style text-danger leading-[1.4]">{error.message}</p>;
  if (!data) return <p className="caption-style text-subtle">Loading the app&apos;s events…</p>;
  return (
    <div className="flex flex-col gap-4">
      <p className="caption-style text-subtle leading-[1.4]">
        Events are matched by their canonical name: the {data.app.prefix ? <code className="font-mono">{data.app.prefix}.</code> : "app"} prefix is stripped and dots, dashes and underscores become underscores, so <code className="font-mono">scrollworthy.paywall.viewed</code> reads as <code className="font-mono">paywall_viewed</code>. Override any role with one of this app&apos;s real events.
      </p>
      <div className="divide-line-strong divide-y">
        {EVENT_ROLES.map((role) => (
          <RoleRow key={role} role={role} catalog={data} onChange={change} busy={busy} />
        ))}
      </div>
      <div className="border-line-strong max-h-[320px] overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-3">Event · last 90 days</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="pr-3 text-right">Count</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.events.map((e) => (
              <TableRow key={e.event}>
                <TableCell className="max-w-[280px] pl-3">
                  <EventName canonical={e.canonical} raw={e.event} />
                </TableCell>
                <TableCell>
                  <RoleTag role={e.role} />
                </TableCell>
                <TableCell className="pr-3 text-right tabular-nums">{formatCompact(e.count)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!data.events.length && <p className="caption-style text-subtle px-3 py-4">No events for this app in the last 90 days.</p>}
      </div>
    </div>
  );
}

export default function EventMapping() {
  const { data: apps } = useApi<MappedTrackedApp[]>("/api/posthog/mappings");
  const [picked, setPicked] = useState<number | null>(null);
  if (!apps) return <p className="caption-style text-subtle">Loading…</p>;
  if (!apps.length) return <p className="text-subtle">Map at least one app above to review its events.</p>;
  const appId = apps.some((a) => a.id === picked) ? (picked as number) : apps[0].id;
  return (
    <div className="flex flex-col gap-4">
      {apps.length > 1 && (
        <Select value={String(appId)} onValueChange={(v) => setPicked(Number(v))}>
          <SelectTrigger aria-label="App" className="h-[30px] w-auto min-w-[200px] self-start rounded-full text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {apps.map((a) => (
              <SelectItem key={a.id} value={String(a.id)}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <AppEvents key={appId} appId={appId} />
    </div>
  );
}
