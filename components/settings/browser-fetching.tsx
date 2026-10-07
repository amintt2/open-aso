"use client";

import { useState } from "react";
import { toast } from "sonner";
import Tag from "@/components/_ui/tag";
import ToggleRow from "@/components/mcp/toggle-row";
import { setPaused, usePaused, useWorkerSnapshot } from "@/components/worker/worker-store";
import { api, useApi } from "@/lib/client/api";
import { formatCompact, timeAgo } from "@/lib/client/format";
import SettingsCard, { KeyValue } from "./settings-card";

export type WorkerStatusInfo = {
  platformShared: boolean;
  shared: boolean;
  canManage: boolean;
  sharedCapPerHour: number;
  workers: { own: number; sharedPeers: number };
  stats: {
    doneHour: number;
    failedHour: number;
    doneToday: number;
    failedToday: number;
    servedSharedToday: number;
    open: number;
    lastError: { message: string; at: string | null } | null;
  };
};

const PHASE_TEXT = {
  starting: "Starting",
  working: "Fetching now",
  idle: "Ready",
  standby: "Another tab is fetching",
  paused: "Paused in this browser",
  limited: "Paused by Apple's rate limit",
  asleep: "Sleeping while the tab is hidden",
  off: "Off",
} as const;

export default function BrowserFetching() {
  const { data, mutate } = useApi<WorkerStatusInfo>("/api/worker/status", { refreshInterval: 10_000 });
  const paused = usePaused();
  const local = useWorkerSnapshot();
  const [saving, setSaving] = useState(false);
  const s = data?.stats;

  async function toggleShared(next: boolean) {
    setSaving(true);
    try {
      await mutate(await api<WorkerStatusInfo>("/api/worker/status", { method: "PUT", body: { shared: next } }), { revalidate: false });
      toast.success(next ? "Joined the shared network" : "Left the shared network");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsCard
      id="browser-fetching"
      title="Browser fetching"
      description="Apple limits how often one IP address can read public App Store data. While Open ASO is open, your browser fetches App Store search results, app details and reviews for this workspace directly from Apple, so refreshes don't wait on the server's limit. Only one tab per browser does this, at most 15 requests a minute, and it backs off when Apple asks it to."
      aside={
        data && (
          <Tag tone={data.workers.own > 0 ? "green" : "neutral"} size="sm" className="text-[12px]">
            {data.workers.own > 0 ? `${data.workers.own} browser${data.workers.own > 1 ? "s" : ""} active` : "No browser active"}
          </Tag>
        )
      }
    >
      <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
        <KeyValue label="This browser" value={paused ? PHASE_TEXT.paused : PHASE_TEXT[local.phase]} />
        <KeyValue label="Done this hour" value={s ? formatCompact(s.doneHour) : "—"} />
        <KeyValue label="Done today" value={s ? formatCompact(s.doneToday) : "—"} />
        <KeyValue
          label="Last error"
          value={s?.lastError ? `${s.lastError.message}${s.lastError.at ? ` · ${timeAgo(s.lastError.at)}` : ""}` : "None"}
        />
      </div>
      <ToggleRow
        id="worker-pause"
        label="Pause fetching in this browser"
        description="Stops this browser from fetching. App Store data still loads through the server, just more slowly. Only affects this browser."
        checked={paused}
        onChange={(next) => setPaused(next)}
      />
      {data?.platformShared && (
        <ToggleRow
          id="worker-shared"
          label="Share your connection"
          description={
            <>
              While Open ASO is open, your browser may also fetch public App Store data for other workspaces that joined, and theirs for you. Capped at{" "}
              {data.sharedCapPerHour} requests/hour. Results from other people&apos;s browsers are only used for your own views.
              {data.shared &&
                ` ${data.workers.sharedPeers} shared browser${data.workers.sharedPeers === 1 ? "" : "s"} online · ${formatCompact(s?.servedSharedToday ?? 0)} served by this workspace today.`}
              {!data.canManage && " Only workspace owners and admins can change this."}
            </>
          }
          checked={data.shared}
          disabled={!data.canManage || saving}
          onChange={toggleShared}
        />
      )}
    </SettingsCard>
  );
}
