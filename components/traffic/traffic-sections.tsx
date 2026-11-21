"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import AttributionTab from "@/components/analytics/attribution-tab";
import RevenueTab from "@/components/analytics/revenue-tab";
import type { AnalyticsFilterState } from "@/components/analytics/use-analytics";
import ProductExperiments from "@/components/posthog/product-experiments";
import ProductFunnel from "@/components/posthog/product-funnel";
import ProductLive from "@/components/posthog/product-live";
import ProductOverview from "@/components/posthog/product-overview";
import ProductRetention from "@/components/posthog/product-retention";
import ProductVersions from "@/components/posthog/product-versions";
import type { ProductTarget } from "@/components/posthog/use-posthog";
import type { TrackedApp } from "@/lib/client/types";
import type { TrafficResult, TrafficSource } from "@/lib/traffic/types";
import AppleSection from "./apple-section";
import ConnectLine from "./connect-line";
import CountriesTable from "./countries-table";

export const SECTIONS = [
  { value: "sources", label: "Sources" },
  { value: "countries", label: "Countries" },
  { value: "retention", label: "Retention" },
  { value: "funnel", label: "In-app funnel" },
  { value: "versions", label: "Versions" },
  { value: "experiments", label: "Experiments" },
  { value: "revenue", label: "Revenue" },
  { value: "events", label: "Events" },
] as const;

export type SectionKey = (typeof SECTIONS)[number]["value"];

const POSTHOG_NEED: Partial<Record<SectionKey, string>> = {
  retention: "day 1, day 7 and day 30 retention by install cohort",
  funnel: "the onboarding, paywall and purchase funnel",
  versions: "users and first opens per app version",
  experiments: "feature-flag experiments with paywall and purchase rates",
  events: "daily active users, top events and the live event stream",
};

function PosthogGate({ source, need, children }: { source: TrafficSource; need: string; children: ReactNode }) {
  if (source.state === "ok") return <>{children}</>;
  if (source.state === "setup") return <ConnectLine text={`This app isn't mapped to a PostHog app yet. Map it to see ${need}.`} action="Map in Integrations" />;
  if (source.state === "error") return <ConnectLine tone="error" text={source.message ?? "PostHog could not be reached."} action="Check PostHog" />;
  return <ConnectLine text={`Connect PostHog to see ${need}.`} />;
}

export default function TrafficSection({
  section,
  app,
  data,
  onCountry,
  syncing,
  onSync,
  onPreview,
}: {
  section: SectionKey;
  app: TrackedApp;
  data: TrafficResult;
  onCountry: (code: string) => void;
  syncing: boolean;
  onSync: (opts?: { fixtures?: "data" }) => void;
  onPreview: () => void;
}) {
  const router = useRouter();
  const connect = () => router.push("/integrations");
  const target: ProductTarget = { appId: data.demo ? null : app.id, demo: data.demo ? "tappy" : null, days: data.days };
  const filters: AnalyticsFilterState = { appId: String(app.id), days: data.days, sandbox: false, demo: data.demo ? "only" : "never" };
  const key = `${section}-${data.demo}-${app.id}`;

  if (section === "sources") return <AppleSection app={app} days={data.days} country={data.country} demo={data.demo} syncing={syncing} onSync={onSync} onPreview={onPreview} />;
  if (section === "countries") return <CountriesTable data={data} appId={app.id} onSelect={onCountry} />;
  const scope = data.country === "all" ? null : (
    <p className="caption-style text-warning">
      This section is not split by country: it shows all countries, while the funnel above is filtered on {data.country.toUpperCase()}.
    </p>
  );
  if (section === "revenue")
    return data.sources.revenue.state === "ok" ? (
      <div className="flex flex-col gap-4">
        {scope}
        <RevenueTab filters={filters} />
        {data.attribution ? <AttributionTab filters={filters} /> : <ConnectLine text="Install the Open ASO SDK to split installs, trials and revenue between Apple Ads and organic." />}
      </div>
    ) : data.sources.revenue.state === "error" ? (
      <ConnectLine tone="error" text={data.sources.revenue.message ?? "Revenue could not be loaded."} />
    ) : (
      <ConnectLine text="Connect RevenueCat or Superwall to see trials, purchases, refunds and net revenue per day." />
    );

  const views: Partial<Record<SectionKey, ReactNode>> = {
    retention: <ProductRetention key={key} target={target} onConnect={connect} />,
    funnel: <ProductFunnel key={key} target={target} onConnect={connect} />,
    versions: <ProductVersions key={key} target={target} onConnect={connect} />,
    experiments: <ProductExperiments key={key} target={target} onConnect={connect} />,
    events: (
      <div className="flex flex-col gap-6">
        <ProductOverview key={key} target={target} onConnect={connect} />
        <ProductLive key={`live-${key}`} target={target} onConnect={connect} />
      </div>
    ),
  };
  return (
    <PosthogGate source={data.sources.posthog} need={POSTHOG_NEED[section] ?? "product analytics"}>
      <div className="flex flex-col gap-4">
        {scope}
        {views[section]}
      </div>
    </PosthogGate>
  );
}
