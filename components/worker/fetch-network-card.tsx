"use client";

import Tag from "@/components/_ui/tag";
import SettingsCard, { KeyValue } from "@/components/settings/settings-card";
import { useApi } from "@/lib/client/api";
import { formatCompact } from "@/lib/client/format";

type FetchNetwork = {
  egress: {
    rpmPerEgress: number;
    egresses: { label: string; cooldownMs: number; inFlight: number; requests: number; rateLimited: number }[];
  };
  workers: { total: number; shared: number; workspaces: number };
  queue: { pending: number; leased: number; doneHour: number; failedHour: number; sharedDoneHour: number; doneToday: number; failedToday: number };
  sharedEnabled: boolean;
  sharedWorkspaces: number;
};

export default function FetchNetworkCard() {
  const { data, error } = useApi<FetchNetwork>("/api/worker/admin", { refreshInterval: 10_000 });
  const q = data?.queue;
  return (
    <SettingsCard
      title="Fetch network"
      description={`Server egress paced at ${data?.egress.rpmPerEgress ?? "—"} requests/min per IP, plus signed-in browsers fetching App Store data for their own workspace.`}
      aside={
        data && (
          <Tag tone={data.sharedEnabled ? "green" : "neutral"} size="sm" className="text-[12px]">
            {data.sharedEnabled ? `Shared network on · ${data.sharedWorkspaces} workspaces` : "Shared network off"}
          </Tag>
        )
      }
    >
      {error && <p className="text-danger">{error.message}</p>}
      <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
        <KeyValue label="Browsers online" value={data ? `${data.workers.total} in ${data.workers.workspaces} workspaces` : "—"} />
        <KeyValue label="Queued / leased" value={q ? `${q.pending} / ${q.leased}` : "—"} />
        <KeyValue label="Browser fetches, last hour" value={q ? `${formatCompact(q.doneHour)} ok · ${formatCompact(q.failedHour)} failed · ${formatCompact(q.sharedDoneHour)} shared` : "—"} />
        <KeyValue label="Browser fetches today" value={q ? `${formatCompact(q.doneToday)} ok · ${formatCompact(q.failedToday)} failed` : "—"} />
      </div>
      {data && (
        <div className="grid gap-2">
          {data.egress.egresses.map((e) => (
            <div key={e.label} className="caption-style text-soft flex flex-wrap items-center justify-between gap-2 tabular-nums">
              <span>{e.label}</span>
              <span>
                {formatCompact(e.requests)} requests · {formatCompact(e.rateLimited)} rate limited · {e.inFlight} in flight
                {e.cooldownMs > 0 && ` · cooling down ${Math.ceil(e.cooldownMs / 1000)}s`}
              </span>
            </div>
          ))}
        </div>
      )}
    </SettingsCard>
  );
}
