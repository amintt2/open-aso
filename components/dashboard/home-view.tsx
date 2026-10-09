"use client";

import { Plus } from "lucide-react";
import Button from "@/components/_ui/button";
import PageHeader from "@/components/shell/page-header";
import StoreRow from "@/components/store-analytics/store-row";
import { useApi } from "@/lib/client/api";
import type { HomeKpis, MoversResult } from "@/lib/dashboard/types";
import { useUiStore } from "@/stores/ui-store";
import { AlertsList, QuickActions } from "./alerts-actions";
import AppsGrid from "./apps-grid";
import { InstallsRevenueChart, VisibilityLines } from "./home-charts";
import {
  AsoTiles,
  BusinessTiles,
  PosthogRow,
  TileSkeletons,
} from "./kpi-tiles";
import MoversList from "./movers-list";
import { SectionTitle } from "./parts";
import { DownloadsMap, Experiments, LiveEvents } from "./posthog-widgets";
import { Card, SkeletonRows, WidgetError } from "./widget";

function KpiRow() {
  const { data, error } = useApi<HomeKpis>("/api/dashboard/kpis");
  if (error && !data) return <WidgetError message={error.message} />;
  return (
    <div className="grid grid-cols-2 gap-3 *:last:col-span-2 md:grid-cols-12 md:*:col-span-3 md:[&>*:nth-child(n+5)]:col-span-4">
      {data ? (
        <>
          <AsoTiles data={data} />
          <BusinessTiles data={data} />
        </>
      ) : (
        <TileSkeletons count={7} />
      )}
    </div>
  );
}

function Movers() {
  const { data, error } = useApi<MoversResult>("/api/dashboard/movers");
  return (
    <Card
      title="Top movers"
      description="Biggest rank changes across all apps over 7 days."
    >
      {error && !data ? (
        <WidgetError message={error.message} />
      ) : !data ? (
        <SkeletonRows rows={6} />
      ) : (
        <MoversList
          gainers={data.gainers}
          losers={data.losers}
          hrefFor={(m) => `/apps/${m.appId}/trends`}
        />
      )}
    </Card>
  );
}

export default function HomeView() {
  const setAddAppOpen = useUiStore((s) => s.setAddAppOpen);
  return (
    <>
      <PageHeader
        title="Dashboard"
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setAddAppOpen(true)}
          >
            <Plus aria-hidden className="size-3.5" />
            Add app
          </Button>
        }
      />
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 p-4">
        <KpiRow />
        <StoreRow onlyWithData />
        <PosthogRow />
        <SectionTitle>Apps</SectionTitle>
        <AppsGrid />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <VisibilityLines />
          <InstallsRevenueChart />
        </div>
        <DownloadsMap filterable />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <Movers />
          <Card
            title="Alerts"
            description="Ranking drops, stale data and integration errors."
          >
            <AlertsList />
          </Card>
          <LiveEvents />
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <Experiments limit={3} />
          </div>
          <Card title="Quick actions" className="xl:self-start">
            <QuickActions />
          </Card>
        </div>
      </div>
    </>
  );
}
