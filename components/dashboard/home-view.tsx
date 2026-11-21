"use client";

import { useState } from "react";
import { FlaskConical, Plus } from "lucide-react";
import Button from "@/components/_ui/button";
import Tag from "@/components/_ui/tag";
import { shortDate } from "@/components/analytics/chart-kit";
import { AddToClaudeButton, useClaudeConnect } from "@/components/mcp/claude-connect";
import type { HomeClaude } from "@/components/mcp/types";
import PageHeader from "@/components/shell/page-header";
import { Segmented } from "@/components/store-analytics/parts";
import { useApi } from "@/lib/client/api";
import type { PortfolioResult } from "@/lib/dashboard/portfolio-types";
import type { MoversResult } from "@/lib/dashboard/types";
import { TRAFFIC_DAYS, type TrafficDays } from "@/lib/traffic/types";
import { useUiStore } from "@/stores/ui-store";
import { AlertsList } from "./alerts-actions";
import MoversList from "./movers-list";
import ContributionChart from "./portfolio/contribution-chart";
import CountriesMatrix from "./portfolio/countries-matrix";
import PortfolioFunnel from "./portfolio/portfolio-funnel";
import PortfolioTable from "./portfolio/portfolio-table";
import TopKeywords from "./portfolio/top-keywords";
import { Card, Skeleton, SkeletonRows, WidgetError } from "./widget";

const PERIODS = TRAFFIC_DAYS.map((d) => ({ key: `${d}` as `${TrafficDays}`, label: `${d}d` }));

function Movers() {
  const { data, error } = useApi<MoversResult>("/api/dashboard/movers");
  return (
    <Card title="Top movers · 7d" description="Biggest rank changes across all apps over the last 7 days.">
      {error && !data ? <WidgetError message={error.message} /> : !data ? <SkeletonRows rows={6} /> : <MoversList gainers={data.gainers} losers={data.losers} hrefFor={(m) => `/apps/${m.appId}/trends`} />}
    </Card>
  );
}

function ClaudeStrip({ claude }: { claude: HomeClaude }) {
  const { onOpen } = useClaudeConnect(claude);
  if (claude.connected) return null;
  return (
    <div className="border-border flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-2.5">
      <span className="caption-style text-soft">Ask Claude about these apps in plain language: connect {claude.name} to Claude, read-only by default.</span>
      <span className="flex items-center gap-3">
        <Button variant="link" size="none" href="/mcp#connect" className="caption-style">
          Other clients
        </Button>
        <AddToClaudeButton href={claude.claudeUrl} size="sm" onOpen={onOpen} />
      </span>
    </div>
  );
}

function Scope({ data }: { data: PortfolioResult }) {
  return (
    <p className="caption-style text-subtle flex flex-wrap items-center gap-2">
      {data.demo && (
        <Tag tone="amber" size="sm" className="caption-style h-[20px] gap-1" title="Generated apps and numbers so you can see the portfolio view. Nothing here is yours.">
          <FlaskConical aria-hidden className="size-3" />
          Sample data
        </Tag>
      )}
      <span>
        {data.apps.length} {data.apps.length === 1 ? "app" : "apps"} · last {data.days} days
        {data.appleThrough ? ` · Apple data through ${shortDate(data.appleThrough)} (published 1 to 3 days late)` : ""} · PostHog and revenue through today
      </span>
    </p>
  );
}

export default function HomeView({ claude }: { claude: HomeClaude }) {
  const setAddAppOpen = useUiStore((s) => s.setAddAppOpen);
  const [days, setDays] = useState<`${TrafficDays}`>("30");
  const [demo, setDemo] = useState(false);
  const { data, error } = useApi<PortfolioResult>(`/api/dashboard/portfolio?days=${days}&demo=${demo ? 1 : 0}`, { keepPreviousData: true });
  const empty = !!data && !data.demo && data.steps.every((s) => s.value == null);
  return (
    <>
      <PageHeader
        title="All apps"
        description="Your whole portfolio: the funnel summed across apps, then which app and country it comes from."
        actions={
          <div className="flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-2 lg:max-w-none">
            <Segmented label="Period" value={days} options={PERIODS} onChange={setDays} />
            {(demo || empty) && (
              <Button variant="secondary" size="sm" onClick={() => setDemo((v) => !v)} title="Generated apps and numbers to preview the page. They never mix with your real data.">
                <FlaskConical aria-hidden className="size-3.5" />
                {demo ? "Exit sample data" : "Preview sample data"}
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => setAddAppOpen(true)}>
              <Plus aria-hidden className="size-3.5" />
              Add app
            </Button>
          </div>
        }
      />
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 p-4">
        {error && !data ? (
          <WidgetError message={error.message} />
        ) : !data ? (
          <>
            <Skeleton className="h-[112px] w-full rounded-xl" />
            <Skeleton className="h-[420px] w-full rounded-xl" />
            <Skeleton className="h-[260px] w-full rounded-xl" />
          </>
        ) : (
          <>
            <Scope data={data} />
            <PortfolioFunnel data={data} />
            <ContributionChart key={data.demo ? "sample" : "real"} data={data} />
            <PortfolioTable data={data} />
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <CountriesMatrix data={data} />
              <TopKeywords data={data} />
            </div>
          </>
        )}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Movers />
          <Card title="Alerts" description="Ranking drops, stale data and integration errors.">
            <AlertsList />
          </Card>
        </div>
        <ClaudeStrip claude={claude} />
      </div>
    </>
  );
}
