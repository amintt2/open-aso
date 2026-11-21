"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChartColumnIncreasing, FlaskConical, Loader2, RefreshCw } from "lucide-react";
import Button from "@/components/_ui/button";
import Tag from "@/components/_ui/tag";
import { Tabs, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import { shortDate } from "@/components/analytics/chart-kit";
import { ErrorBlock, LoadingBlock } from "@/components/analytics/parts";
import CountrySelect from "@/components/shell/country-select";
import EmptyState from "@/components/shell/empty-state";
import PageHeader from "@/components/shell/page-header";
import { Segmented } from "@/components/store-analytics/parts";
import { useStoreSync } from "@/components/store-analytics/use-sync";
import { ALL_COUNTRIES, useAppCountry, useCurrentApp } from "@/hooks/use-app";
import { useApi } from "@/lib/client/api";
import { TRAFFIC_DAYS, type TrafficDays, type TrafficResult } from "@/lib/traffic/types";
import FunnelStrip from "./funnel-strip";
import OverlayChart from "./overlay-chart";
import TrafficSection, { SECTIONS, type SectionKey } from "./traffic-sections";

const PERIODS = TRAFFIC_DAYS.map((d) => ({ key: `${d}` as `${TrafficDays}`, label: `${d}d` }));

function Windows({ data }: { data: TrafficResult }) {
  const { apple, posthog, revenue } = data.sources;
  const parts = [
    apple.state === "ok" && apple.through ? `Apple data through ${shortDate(apple.through)} (Apple publishes 1 to 3 days late)` : null,
    posthog.state === "ok" ? "PostHog through today" : null,
    revenue.state === "ok" ? "revenue through today" : null,
    data.rankings.keywords ? `search estimate from ${data.rankings.keywords.toLocaleString("en-US")} tracked keywords` : null,
  ].filter(Boolean);
  return (
    <p className="caption-style text-subtle flex flex-wrap items-center gap-2">
      {data.demo && (
        <Tag tone="amber" size="sm" className="caption-style h-[20px] gap-1" title="Generated sample data so you can see the layout. Nothing here is your app.">
          <FlaskConical aria-hidden className="size-3" />
          Sample data
        </Tag>
      )}
      <span>
        Last {data.days} days{data.country === "all" ? ", all countries" : `, ${data.country.toUpperCase()}`}
        {parts.length ? ` · ${parts.join(" · ")}` : ""}
      </span>
    </p>
  );
}

export default function TrafficView() {
  const { app, appId, error: appError } = useCurrentApp();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [stored, setCountry] = useAppCountry(app, { allowAll: true });
  const days = TRAFFIC_DAYS.find((d) => d === Number(params.get("days"))) ?? 30;
  const demo = params.get("demo") === "1";
  const section = (SECTIONS.find((s) => s.value === params.get("view"))?.value ?? "sources") as SectionKey;
  const { syncing, sync } = useStoreSync(appId);

  const update = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const { data: latest } = useApi<TrafficResult>(app ? `/api/apps/${appId}/traffic?days=${days}&country=all&demo=${demo ? 1 : 0}` : null, { keepPreviousData: true });
  const countries = useMemo(() => [...new Set([...(app?.countries ?? []), ...(latest?.territories ?? []), ...(latest?.countries.map((c) => c.country) ?? [])])], [app, latest]);
  const country = stored !== ALL_COUNTRIES && countries.includes(stored) ? stored : ALL_COUNTRIES;
  const { data, error } = useApi<TrafficResult>(app ? `/api/apps/${appId}/traffic?days=${days}&country=${country}&demo=${demo ? 1 : 0}` : null, { keepPreviousData: true });

  if (appError) return <EmptyState icon={ChartColumnIncreasing} title="App not found" description="This app is no longer tracked in this workspace." />;

  const nothing = !!data && !demo && Object.values(data.sources).every((s) => s.state !== "ok");
  const appleLive = data?.sources.apple.state === "ok" && !data.sources.apple.demo;

  return (
    <>
      <PageHeader
        title="Traffic"
        description="From App Store impression to revenue: Apple, PostHog and your revenue provider side by side, next to what your rankings predict."
        actions={
          <div className="flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-2 lg:max-w-none">
            <CountrySelect value={country} onChange={setCountry} only={countries} allOption={{ value: ALL_COUNTRIES, label: "All countries" }} />
            <Segmented label="Period" value={`${days}`} options={PERIODS} onChange={(v) => update({ days: v === "30" ? null : v })} />
            {(demo || nothing) && (
              <Button variant="secondary" size="sm" onClick={() => update({ demo: demo ? null : "1" })} title="Generated data to preview the page. It never mixes with your real numbers.">
                <FlaskConical aria-hidden className="size-3.5" />
                {demo ? "Exit sample data" : "Preview sample data"}
              </Button>
            )}
            {appleLive && (
              <Button variant="secondary" size="sm" onClick={() => void sync()} disabled={syncing} title="Fetch the newest reports from Apple">
                {syncing ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <RefreshCw aria-hidden className="size-3.5" />}
                Sync Apple
              </Button>
            )}
          </div>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 p-4">
          {error && !data ? (
            <ErrorBlock message={error.message} />
          ) : !data || !app ? (
            <LoadingBlock />
          ) : (
            <>
              <Windows data={data} />
              <FunnelStrip data={data} href={pathname} />
              <OverlayChart data={data} />
              <Tabs value={section} onValueChange={(value) => update({ view: value === "sources" ? null : value })}>
                <TabsList className="border-border overflow-x-auto border-b">
                  {SECTIONS.map((s) => (
                    <TabsTrigger key={s.value} value={s.value} className="py-3">
                      {s.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <TrafficSection section={section} app={app} data={data} onCountry={(code) => setCountry(code === country ? ALL_COUNTRIES : code)} syncing={syncing} onSync={(opts) => void sync(opts)} onPreview={() => update({ demo: "1" })} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
