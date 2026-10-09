"use client";

import { useState } from "react";
import { ChartColumnIncreasing, FlaskConical, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import { ErrorBlock, LoadingBlock } from "@/components/analytics/parts";
import { AscGateFallback, useAscGate } from "@/components/asc/asc-gate";
import CountrySelect from "@/components/shell/country-select";
import EmptyState from "@/components/shell/empty-state";
import PageHeader from "@/components/shell/page-header";
import { useCurrentApp } from "@/hooks/use-app";
import { COUNTRY_BY_CODE } from "@/lib/appstore/countries";
import type { StoreAnalyticsResult, StoreDays, SyncResult } from "@/lib/asc/analytics/types";
import { api, revalidate, useApi } from "@/lib/client/api";
import { formatDay } from "./format";
import MetricChart from "./metric-chart";
import { Segmented } from "./parts";
import SourceBreakdown from "./source-breakdown";
import StatusBanner, { FreshnessLine } from "./status-banner";
import StoreKpis from "./store-kpis";
import SyncActivity from "./sync-activity";
import TerritoryBreakdown from "./territory-breakdown";

const PERIODS: { key: `${StoreDays}`; label: string }[] = [
  { key: "7", label: "7d" },
  { key: "30", label: "30d" },
  { key: "90", label: "90d" },
  { key: "180", label: "180d" },
];

const DEV = process.env.NODE_ENV !== "production";

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function useSync(appId: number) {
  const [syncing, setSyncing] = useState(false);
  async function sync(opts: { force?: boolean; fixtures?: "data" | "waiting" } = {}) {
    setSyncing(true);
    try {
      const r = await api<SyncResult>("/api/store-analytics/sync", { method: "POST", body: { appId, ...opts } });
      if (r.outcome === "up-to-date")
        toast(`Already up to date: data through ${formatDay(r.dataThrough)}`, {
          description: "Apple publishes once a day. Nothing to fetch until tomorrow.",
          action: { label: "Check anyway", onClick: () => void sync({ ...opts, force: true }) },
        });
      else if (r.outcome === "new-data") toast.success(`Imported ${plural(r.instances, "report")} from Apple`, { description: `Data through ${formatDay(r.dataThrough)} · ${plural(r.calls, "API call")}` });
      else if (r.outcome === "waiting") toast(r.message ?? "Waiting for Apple to generate the first report");
      else toast("No new data from Apple yet", { description: `${plural(r.calls, "API call")} · we'll check again automatically.` });
      await revalidate("/api/store-analytics");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
      await revalidate("/api/store-analytics");
    } finally {
      setSyncing(false);
    }
  }
  return { syncing, sync };
}

function NotConnected({ onConnect, onPreview, onFixtures, busy }: { onConnect: () => void; onPreview: () => void; onFixtures: () => void; busy: boolean }) {
  return (
    <EmptyState
      icon={ChartColumnIncreasing}
      title="See your App Store impressions, page views and downloads"
      description="Connect App Store Connect to import Apple's App Analytics reports: impressions, product page views, first-time downloads and conversion by day, source and territory. Requesting the reports needs an Admin API key once."
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="primary" size="md" onClick={onConnect}>
            Connect App Store Connect
          </Button>
          <Button variant="secondary" size="md" onClick={onPreview}>
            <FlaskConical aria-hidden className="size-3.5" />
            Preview sample data
          </Button>
          {DEV && (
            <Button variant="secondary" size="md" onClick={onFixtures} disabled={busy}>
              Import fixtures (dev)
            </Button>
          )}
        </div>
      }
    />
  );
}

function Body({ data, country, setCountry, onSync, onPreview, syncing }: { data: StoreAnalyticsResult; country: string; setCountry: (c: string) => void; onSync: () => void; onPreview: () => void; syncing: boolean }) {
  return (
    <>
      <StatusBanner data={data} onSync={onSync} onSample={onPreview} syncing={syncing} />
      {data.dataThrough && <FreshnessLine data={data} />}
      {data.totals && (
        <>
          <StoreKpis totals={data.totals} days={data.days} />
          <MetricChart daily={data.daily} />
          <SourceBreakdown sources={data.sources} sourceDaily={data.sourceDaily} days={data.days} />
          <TerritoryBreakdown territories={data.territories} selected={country} onSelect={(code) => setCountry(code === country || !COUNTRY_BY_CODE.has(code) ? "all" : code)} />
        </>
      )}
      {!(data.demo && !data.sync.lastCheckAt) && <SyncActivity sync={data.sync} />}
    </>
  );
}

export default function StoreAnalyticsView() {
  const { app, appId, error: appError } = useCurrentApp();
  const gate = useAscGate(app);
  const [days, setDays] = useState<`${StoreDays}`>("30");
  const [country, setCountry] = useState("all");
  const [preview, setPreview] = useState(false);
  const { syncing, sync } = useSync(appId);
  const url = app ? `/api/store-analytics?appId=${appId}&days=${days}&country=${country}&demo=${preview ? "only" : "never"}` : null;
  const { data, error } = useApi<StoreAnalyticsResult>(url, { keepPreviousData: true });

  if (appError) return <EmptyState icon={ChartColumnIncreasing} title="App not found" description="This app is no longer tracked in this workspace." />;

  const territories = (data?.availableTerritories ?? []).filter((c) => COUNTRY_BY_CODE.has(c));
  const live = data && !preview && data.status !== "not_connected" && data.status !== "not_linked";

  return (
    <>
      <PageHeader
        title="App Store Analytics"
        actions={
          <div className="flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-2 lg:max-w-none">
            {data?.status === "ok" && territories.length > 0 && <CountrySelect value={country} onChange={setCountry} only={territories} allOption={{ value: "all", label: "All territories" }} />}
            {(preview || data?.status === "ok") && <Segmented label="Period" value={days} options={PERIODS} onChange={setDays} />}
            {preview && (
              <Button variant="secondary" size="sm" onClick={() => setPreview(false)}>
                Exit preview
              </Button>
            )}
            {live && (
              <Button variant="secondary" size="sm" onClick={() => void sync()} disabled={syncing} title="Fetch the newest reports from Apple">
                {syncing ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <RefreshCw aria-hidden className="size-3.5" />}
                Sync now
              </Button>
            )}
          </div>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 p-4">
          {error && !data ? (
            <ErrorBlock message={error.message} />
          ) : !data || (preview && !data.demo) ? (
            <LoadingBlock />
          ) : data.status === "not_connected" && !preview ? (
            <NotConnected onConnect={() => gate.setSetupOpen(true)} onPreview={() => setPreview(true)} onFixtures={() => void sync({ fixtures: "data" })} busy={syncing} />
          ) : data.status === "not_linked" && !preview ? (
            <AscGateFallback state={gate.state === "ready" || gate.state === "loading" ? "unlinked" : gate.state} app={app} feature="import App Store Analytics" error={gate.status?.error ?? null} onSetup={() => gate.setSetupOpen(true)} />
          ) : (
            <Body data={data} country={country} setCountry={setCountry} onSync={() => void sync()} onPreview={() => setPreview(true)} syncing={syncing} />
          )}
        </div>
      </div>
      {gate.sheet}
    </>
  );
}
