"use client";

import { LayoutGrid } from "lucide-react";
import CountrySelect from "@/components/shell/country-select";
import EmptyState from "@/components/shell/empty-state";
import PageHeader from "@/components/shell/page-header";
import FunnelStrip from "@/components/traffic/funnel-strip";
import Reconcile from "@/components/traffic/reconcile";
import DistributionChart from "@/components/trends/distribution-chart";
import SearchChart from "@/components/trends/search-chart";
import { ALL_COUNTRIES, useAppCountry, useCurrentApp } from "@/hooks/use-app";
import { useApi } from "@/lib/client/api";
import type { OverviewSummary } from "@/lib/dashboard/types";
import type { TrafficResult } from "@/lib/traffic/types";
import type { TrendsResult } from "@/lib/trends/types";
import MoversList from "../movers-list";
import { SectionTitle } from "../parts";
import { Card, MoreLink, Skeleton, SkeletonRows, WidgetError } from "../widget";
import {
  AdsCard,
  FunnelCard,
  ImpactCard,
  InsightsCard,
  OpportunitiesCard,
  OverviewHeader,
  OverviewKpis,
  ReviewsCard,
  TopKeywords,
} from "./overview-cards";

function TrendCharts({ appId, country }: { appId: number; country: string }) {
  const { data, error } = useApi<TrendsResult>(
    `/api/apps/${appId}/trends?country=${country}&days=30`,
    { keepPreviousData: true },
  );
  if (error && !data) return <WidgetError message={error.message} />;
  if (!data)
    return (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Skeleton className="h-[330px] w-full rounded-xl" />
        <Skeleton className="h-[330px] w-full rounded-xl" />
      </div>
    );
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <SearchChart
        points={data.points}
        versions={data.versions}
        days={data.days}
        contributors={data.contributors}
        appId={appId}
      />
      <DistributionChart points={data.points} days={data.days} />
    </div>
  );
}

function Funnel({ appId, country }: { appId: number; country: string }) {
  const { data, error } = useApi<TrafficResult>(
    `/api/apps/${appId}/traffic?days=30&country=${country}&demo=0`,
    { keepPreviousData: true },
  );
  if (error && !data) return <WidgetError message={error.message} />;
  if (!data) return <Skeleton className="h-[92px] w-full rounded-xl" />;
  return (
    <>
      <FunnelStrip
        data={data}
        href={`/apps/${appId}/traffic`}
        action={<MoreLink href={`/apps/${appId}/traffic`}>Traffic</MoreLink>}
      />
      <Reconcile items={data.reconcile} />
    </>
  );
}

function Movers({ appId, country }: { appId: number; country: string }) {
  const { data, error } = useApi<TrendsResult>(
    `/api/apps/${appId}/trends?country=${country}&days=30`,
    { keepPreviousData: true },
  );
  return (
    <Card
      title="Movers · 30d"
      description="Biggest rank changes since the start of the window."
      actions={<MoreLink href={`/apps/${appId}/trends`}>Trends</MoreLink>}
    >
      {error && !data ? (
        <WidgetError message={error.message} />
      ) : !data ? (
        <SkeletonRows rows={6} />
      ) : (
        <MoversList
          gainers={data.movers.gainers}
          losers={data.movers.losers}
          hrefFor={() => `/apps/${appId}/trends`}
          limit={8}
        />
      )}
    </Card>
  );
}

export default function OverviewView() {
  const { app, appId, error: appError } = useCurrentApp();
  const [stored, setCountry] = useAppCountry(app, { allowAll: true });
  const countries = app?.countries ?? [];
  const country =
    stored === ALL_COUNTRIES || countries.includes(stored)
      ? stored
      : ALL_COUNTRIES;
  const { data: summary, error } = useApi<OverviewSummary>(
    app ? `/api/dashboard/apps/${appId}/summary?country=${country}` : null,
    { keepPreviousData: true },
  );

  if (appError)
    return (
      <EmptyState
        icon={LayoutGrid}
        title="App not found"
        description="This app is no longer tracked in this workspace."
      />
    );

  return (
    <>
      <PageHeader
        title="Overview"
        description="How is this app doing: the real funnel first, then where its keywords rank."
        actions={
          app && (
            <CountrySelect
              value={country}
              onChange={setCountry}
              only={countries}
              allOption={{ value: ALL_COUNTRIES, label: "All countries" }}
            />
          )
        }
      />
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 p-4">
        {error && !summary ? (
          <WidgetError message={error.message} />
        ) : (
          <OverviewHeader data={summary} />
        )}
        {!summary && !error && (
          <Skeleton className="h-[90px] w-full rounded-xl" />
        )}
        {app && <Funnel appId={appId} country={country} />}
        <SectionTitle>
          Search rankings ·{" "}
          {country === ALL_COUNTRIES ? "all countries" : country.toUpperCase()}
        </SectionTitle>
        <OverviewKpis data={summary} />
        {app && (
          <>
            <TrendCharts appId={appId} country={country} />
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="min-w-0 xl:col-span-2">
                <TopKeywords appId={appId} country={country} />
              </div>
              <Movers appId={appId} country={country} />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
              <ImpactCard appId={appId} country={country} />
              <InsightsCard appId={appId} country={country} />
              <AdsCard appId={appId} />
              <FunnelCard appId={appId} />
              <ReviewsCard appId={appId} country={country} />
              <OpportunitiesCard appId={appId} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
