"use client";

import { useState } from "react";
import { FlaskConical, Globe2, Loader2, Megaphone, Plug, Plus, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import Tag from "@/components/_ui/tag";
import PageHeader from "@/components/shell/page-header";
import EmptyState from "@/components/shell/empty-state";
import { api, revalidate, useApi } from "@/lib/client/api";
import type { AdsConnection, AdsDashboard, AdsOrg } from "@/lib/apple-ads/types";
import AdGroupSheet from "./adgroup-sheet";
import { ErrorNote, LoadingRows, RangePicker } from "./bits";
import CampaignSheet from "./campaign-sheet";
import CampaignsTable from "./campaigns-table";
import { CannibalizationBanner, CannibalizationSheet } from "./cannibalization";
import ChangeProvider from "./change-provider";
import { MiniChart, SERIES } from "./charts";
import ConnectSheet from "./connect-sheet";
import CreateCampaignSheet from "./create-campaign-sheet";
import { AddKeywordsSheet, AddNegativesSheet, CreateAdGroupSheet } from "./edit-sheets";
import { count, money, moneyCompact, shortDate } from "./format";
import KeywordTrendSheet from "./keyword-trend-sheet";
import KpiTiles from "./kpi-tiles";
import MapSheet from "./map-sheet";
import PlaybookSheet from "./playbook-sheet";
import Recommendations from "./recommendations";
import { useAdsQuery, useAdsUi } from "./store";

type ConnectionResponse = { connection: AdsConnection; orgs: AdsOrg[] };

function NotConnected() {
  const openSheet = useAdsUi((s) => s.openSheet);
  const setDemo = useAdsUi((s) => s.setDemo);
  return (
    <EmptyState
      icon={Megaphone}
      title="Connect Apple Ads"
      description="Manage Search Results campaigns, bids, keywords and negatives from Open ASO. Credentials are scoped to this workspace; every change is shown as a diff before it is sent."
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="primary" size="md" onClick={() => openSheet("connect")}>
            <Plug aria-hidden className="size-3.5" />
            Connect Apple Ads
          </Button>
          <Button variant="secondary" size="md" onClick={() => setDemo(true)}>
            <FlaskConical aria-hidden className="size-3.5" />
            Preview with demo data
          </Button>
        </div>
      }
    />
  );
}

function Dashboard({ data }: { data: AdsDashboard }) {
  const openSheet = useAdsUi((s) => s.openSheet);
  const setDemo = useAdsUi((s) => s.setDemo);
  const currency = data.currency;
  return (
    <div className="flex flex-col gap-4 p-4">
      {data.demo && (
        <div className="border-(--tag-purple-border) bg-(--tag-purple-bg) flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3">
          <FlaskConical aria-hidden className="text-(--tag-purple-text) size-4 shrink-0" />
          <p className="text-(--tag-purple-text) min-w-0 flex-1 text-[13px]">Demo data: a synthetic account generated to preview the module. Changes are simulated and never sent anywhere.</p>
          <Button variant="secondary" size="sm" onClick={() => openSheet("connect")}>
            Connect real account
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Exit demo" onClick={() => setDemo(false)}>
            <X aria-hidden className="size-3.5" />
          </Button>
        </div>
      )}
      {data.warnings.map((w) => (
        <p key={w} className="caption-style text-warning">
          {w}
        </p>
      ))}
      <CannibalizationBanner issues={data.cannibalization} />
      <KpiTiles data={data} />
      <div className="grid gap-4 lg:grid-cols-2">
        <MiniChart title="Spend" total={moneyCompact(data.totals.spend, currency)} data={data.daily} dataKey="spend" kind="bar" color={SERIES.spend} format={(v) => money(v, currency)} axisFormat={(v) => (v >= 10_000 ? moneyCompact(v, currency) : money(v, currency, 0))} />
        <MiniChart title="Installs" total={count(data.totals.installs)} data={data.daily} dataKey="installs" kind="area" color={SERIES.installs} format={(v) => count(v)} />
      </div>
      <div className="grid gap-4 2xl:grid-cols-[1fr_420px]">
        <section className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2>Campaigns</h2>
            <span className="caption-style text-subtle">
              {shortDate(data.startDate)} – {shortDate(data.endDate)} · {currency}
            </span>
          </div>
          {data.campaigns.length ? (
            <CampaignsTable campaigns={data.campaigns} currency={currency} />
          ) : (
            <div className="bg-card border-border rounded-xl border">
              <EmptyState
                icon={Megaphone}
                title="No campaigns yet"
                description="Start with one exact-match Search Results campaign per country."
                action={
                  <Button variant="primary" size="md" onClick={() => openSheet("createCampaign")}>
                    <Plus aria-hidden className="size-3.5" />
                    New campaign
                  </Button>
                }
              />
            </div>
          )}
        </section>
        <Recommendations data={data} />
      </div>
      <p className="caption-style text-subtle">
        Installs are tap-through installs reported by Apple. Revenue and ROAS come from your own attribution data (installs and revenue events) and are in USD. Updated {new Date(data.generatedAt).toLocaleTimeString()}.
      </p>
      <MapSheet countries={data.countries} currency={currency} />
      <CannibalizationSheet issues={data.cannibalization} />
    </div>
  );
}

function Content() {
  const demo = useAdsUi((s) => s.demo);
  const days = useAdsUi((s) => s.days);
  const setDays = useAdsUi((s) => s.setDays);
  const openSheet = useAdsUi((s) => s.openSheet);
  const query = useAdsQuery();
  const { data: conn, error: connError } = useApi<ConnectionResponse>("/api/apple-ads/connection");
  const connected = !!conn?.connection.connected;
  const active = demo || connected;
  const { data, error, isLoading, isValidating } = useApi<AdsDashboard>(active ? `/api/apple-ads/dashboard?${query}` : null, { keepPreviousData: true });
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      if (!demo) await api("/api/apple-ads/refresh", { method: "POST" });
      await revalidate("/api/apple-ads/");
      toast.success("Apple Ads data refreshed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  const badge = demo ? (
    <Tag tone="purple" size="sm" className="caption-style">
      Demo
    </Tag>
  ) : connected ? (
    <Tag tone="neutral" size="sm" className="caption-style">
      {conn?.connection.orgName ?? conn?.connection.orgId}
    </Tag>
  ) : null;

  return (
    <>
      <PageHeader
        title="Apple Ads"
        badge={badge}
        actions={
          <>
            {active && <RangePicker value={days} onChange={setDays} />}
            {active && (
              <>
                <Button variant="secondary" size="icon" aria-label="Refresh data" title="Refresh" disabled={refreshing || isValidating} onClick={refresh}>
                  {refreshing || isValidating ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <RefreshCw aria-hidden className="size-3.5" />}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => openSheet("map")}>
                  <Globe2 aria-hidden className="size-3.5" />
                  Map
                </Button>
              </>
            )}
            <Button variant="secondary" size="sm" onClick={() => openSheet("connect")}>
              <Plug aria-hidden className="size-3.5" />
              {connected ? "Connection" : "Connect"}
            </Button>
            {active && (
              <Button variant="primary" size="sm" onClick={() => openSheet("createCampaign")}>
                <Plus aria-hidden className="size-3.5" />
                New campaign
              </Button>
            )}
          </>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ErrorNote error={connError} />
        {conn && !active && <NotConnected />}
        {active && error && !data && <ErrorNote error={error} />}
        {active && isLoading && !data && <LoadingRows rows={8} />}
        {active && data && <Dashboard data={data} />}
        {active && error && data && <ErrorNote error={error} />}
      </div>
      <ConnectSheet />
      <CreateCampaignSheet />
      <CampaignSheet />
      <AdGroupSheet />
      <KeywordTrendSheet />
      <CreateAdGroupSheet />
      <AddKeywordsSheet />
      <AddNegativesSheet />
      <PlaybookSheet />
    </>
  );
}

export default function AppleAdsPage() {
  return (
    <ChangeProvider>
      <Content />
    </ChangeProvider>
  );
}
