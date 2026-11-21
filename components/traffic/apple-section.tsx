"use client";

import Button from "@/components/_ui/button";
import { ErrorBlock, LoadingBlock } from "@/components/analytics/parts";
import { AscGateFallback, useAscGate } from "@/components/asc/asc-gate";
import MetricChart from "@/components/store-analytics/metric-chart";
import SourceBreakdown from "@/components/store-analytics/source-breakdown";
import StatusBanner, { FreshnessLine } from "@/components/store-analytics/status-banner";
import SyncActivity from "@/components/store-analytics/sync-activity";
import type { StoreAnalyticsResult } from "@/lib/asc/analytics/types";
import { useApi } from "@/lib/client/api";
import type { TrackedApp } from "@/lib/client/types";
import ConnectLine from "./connect-line";

const DEV = process.env.NODE_ENV !== "production";

export default function AppleSection({
  app,
  days,
  country,
  demo,
  syncing,
  onSync,
  onPreview,
}: {
  app: TrackedApp;
  days: number;
  country: string;
  demo: boolean;
  syncing: boolean;
  onSync: (opts?: { fixtures?: "data" }) => void;
  onPreview: () => void;
}) {
  const gate = useAscGate(app);
  const { data, error } = useApi<StoreAnalyticsResult>(`/api/store-analytics?appId=${app.id}&days=${days}&country=${country}&demo=${demo ? "only" : "never"}`, { keepPreviousData: true });
  if (error && !data) return <ErrorBlock message={error.message} />;
  if (!data || (demo && !data.demo)) return <LoadingBlock />;
  if (data.status === "not_connected")
    return (
      <div className="flex flex-col gap-3">
        <ConnectLine text="Connect App Store Connect to see impressions, page views and downloads by source: search, browse, referrers. It needs an Admin API key once." />
        {DEV && (
          <Button variant="secondary" size="sm" className="self-start" onClick={() => onSync({ fixtures: "data" })} disabled={syncing}>
            Import fixtures (dev)
          </Button>
        )}
      </div>
    );
  if (data.status === "not_linked")
    return (
      <>
        <AscGateFallback state={gate.state === "ready" || gate.state === "loading" ? "unlinked" : gate.state} app={app} feature="import App Store Analytics" error={gate.status?.error ?? null} onSetup={() => gate.setSetupOpen(true)} />
        {gate.sheet}
      </>
    );
  return (
    <div className="flex flex-col gap-4">
      <StatusBanner data={data} onSync={() => onSync()} onSample={onPreview} syncing={syncing} />
      {data.dataThrough && <FreshnessLine data={data} />}
      {data.totals && (
        <>
          <SourceBreakdown sources={data.sources} sourceDaily={data.sourceDaily} days={data.days} />
          <MetricChart daily={data.daily} />
        </>
      )}
      {!(data.demo && !data.sync.lastCheckAt) && <SyncActivity sync={data.sync} />}
    </div>
  );
}
