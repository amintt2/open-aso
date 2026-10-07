"use client";

import { useState, type ReactNode } from "react";
import { Activity, Link2 } from "lucide-react";
import Button from "@/components/_ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/_ui/select";
import AppIcon from "@/components/shell/app-icon";
import EmptyState from "@/components/shell/empty-state";
import { LoadingBlock } from "@/components/analytics/parts";
import type { AnalyticsFilterState } from "@/components/analytics/use-analytics";
import { useApi } from "@/lib/client/api";
import type { TrackedApp } from "@/lib/client/types";
import type { MappedTrackedApp, PosthogStatus } from "@/lib/posthog/types";
import PosthogSheet from "./posthog-sheet";
import ProductExperiments from "./product-experiments";
import ProductFunnel from "./product-funnel";
import ProductGeography from "./product-geography";
import ProductLive from "./product-live";
import ProductOverview from "./product-overview";
import ProductRetention from "./product-retention";
import ProductVersions from "./product-versions";
import { Segmented } from "./product-parts";
import type { ProductTarget } from "./use-posthog";

const VIEWS = [
  { value: "overview", label: "Overview" },
  { value: "funnel", label: "Funnel" },
  { value: "retention", label: "Retention" },
  { value: "geography", label: "Geography" },
  { value: "versions", label: "Versions" },
  { value: "experiments", label: "Experiments" },
  { value: "live", label: "Live events" },
] as const;

type ViewKey = (typeof VIEWS)[number]["value"];

const DEMO_APPS = [
  { slug: "tappy", name: "Tappy" },
  { slug: "scrollworthy", name: "Scrollworthy" },
  { slug: "carlog", name: "CarLog" },
];

const COMPONENTS: Record<ViewKey, (props: { target: ProductTarget; onConnect: () => void }) => ReactNode> = {
  overview: ProductOverview,
  funnel: ProductFunnel,
  retention: ProductRetention,
  geography: ProductGeography,
  versions: ProductVersions,
  experiments: ProductExperiments,
  live: ProductLive,
};

export default function ProductTab({ filters, onAppChange }: { filters: AnalyticsFilterState; onAppChange: (appId: string) => void }) {
  const { data: status } = useApi<PosthogStatus>("/api/posthog/status");
  const { data: mapped } = useApi<MappedTrackedApp[]>(status?.configured ? "/api/posthog/mappings" : null);
  const { data: apps } = useApi<TrackedApp[]>("/api/apps");
  const [demo, setDemo] = useState<string | null>(null);
  const [view, setView] = useState<ViewKey>("overview");
  const [sheet, setSheet] = useState(false);
  const connect = () => setSheet(true);
  const sheetEl = <PosthogSheet open={sheet} onOpenChange={setSheet} status={status} />;

  if (!status || (status.configured && !mapped && !demo)) return <LoadingBlock />;

  if (!status.configured && !demo)
    return (
      <>
        <EmptyState
          icon={Activity}
          title="Connect PostHog"
          description="See onboarding funnels, paywall conversion, retention, experiments and live events for each of your apps, straight from the PostHog project they report to."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" size="md" onClick={connect}>
                Connect PostHog
              </Button>
              <Button variant="secondary" size="md" onClick={() => setDemo("tappy")}>
                Preview with demo data
              </Button>
            </div>
          }
        />
        {sheetEl}
      </>
    );

  const selectedId = filters.appId === "all" ? null : Number(filters.appId);
  const mappedApps = mapped ?? [];
  const appId = demo ? null : (selectedId ?? mappedApps[0]?.id ?? null);
  const unmapped = !demo && selectedId !== null && !mappedApps.some((a) => a.id === selectedId);

  if (!demo && (unmapped || !appId)) {
    const name = apps?.find((a) => a.id === selectedId)?.name ?? "This app";
    return (
      <>
        <EmptyState
          icon={Link2}
          title={unmapped ? `${name} isn't mapped to PostHog` : "Map your apps to PostHog"}
          description="Pick each app's bundle id or event prefix so Open ASO knows which PostHog events belong to it."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" size="md" onClick={connect}>
                Map apps
              </Button>
              <Button variant="secondary" size="md" onClick={() => setDemo("tappy")}>
                Preview with demo data
              </Button>
            </div>
          }
        />
        {sheetEl}
      </>
    );
  }

  const target: ProductTarget = { appId, demo, days: filters.days };
  const Current = COMPONENTS[view];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {demo ? (
            <Select value={demo} onValueChange={setDemo}>
              <SelectTrigger aria-label="Demo app" className="h-[30px] w-auto min-w-[150px] rounded-full text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEMO_APPS.map((a) => (
                  <SelectItem key={a.slug} value={a.slug}>
                    {a.name} (demo)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select value={String(appId)} onValueChange={onAppChange}>
              <SelectTrigger aria-label="PostHog app" className="h-[30px] w-auto max-w-[240px] min-w-[150px] rounded-full text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {mappedApps.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    <span className="inline-flex items-center gap-2">
                      <AppIcon src={a.iconUrl} name={a.name} className="size-4" />
                      <span className="truncate">{a.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Segmented label="PostHog view" value={view} onChange={setView} options={[...VIEWS]} />
        </div>
        <div className="flex items-center gap-2">
          {demo && (
            <Button variant="ghost" size="sm" onClick={() => setDemo(null)}>
              Exit demo
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={connect}>
            PostHog settings
          </Button>
        </div>
      </div>
      <Current key={`${view}-${demo ?? appId}`} target={target} onConnect={connect} />
      {sheetEl}
    </div>
  );
}
