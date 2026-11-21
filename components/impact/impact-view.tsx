"use client";

import { useState } from "react";
import { FlaskConical, Info, TrendingUp } from "lucide-react";
import Button from "@/components/_ui/button";
import { ErrorBlock, KpiTile, LoadingBlock } from "@/components/analytics/parts";
import CountrySelect from "@/components/shell/country-select";
import EmptyState from "@/components/shell/empty-state";
import PageHeader from "@/components/shell/page-header";
import { ALL_COUNTRIES, useAppCountry, useCurrentApp } from "@/hooks/use-app";
import { useApi } from "@/lib/client/api";
import { formatCompact, formatPercent } from "@/lib/client/format";
import type { ImpactResult } from "@/lib/impact/types";
import { cn } from "@/lib/utils";
import ImpactChart from "./impact-chart";
import { formatEstimate, formatEstimateUsd } from "./impact-format";
import ImpactMap from "./impact-map";
import ImpactMethod from "./impact-method";
import ImpactSources from "./impact-sources";
import ImpactTable from "./impact-table";

const PERIODS = [7, 30, 90] as const;

function approx(n: number | null, format: (n: number) => string) {
  return n == null ? "—" : n === 0 ? format(0) : `~${format(n)}`;
}

function Caption({ children }: { children: React.ReactNode }) {
  return <span className="caption-style text-subtle truncate">{children}</span>;
}

function Tiles({ data }: { data: ImpactResult }) {
  const t = data.totals;
  const source = data.dataSources.observed === "posthog" ? "PostHog new users" : data.dataSources.observed === "sdk" ? "SDK installs" : data.dataSources.observed === "apple" ? "Apple first-time downloads" : null;
  const organicShare = t.observed && t.organic != null ? t.organic / t.observed : null;
  const explainedShare = t.searchEstimate ? t.explained / t.searchEstimate : null;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <KpiTile
        source={data.demo ? undefined : data.dataSources.observed === "apple" ? "apple" : data.dataSources.observed === "posthog" ? "posthog" : data.dataSources.observed === "sdk" ? "sdk" : undefined}
        label={`Observed installs · ${data.days}d`}
        value={t.observed == null ? "—" : formatCompact(t.observed)}
        hint="Real installs in the tracked countries over the selected period, from the best source connected: Apple first-time downloads, else PostHog first opens, else the SDK"
        delta={
          <Caption>
            {t.observed == null
              ? "No install data connected"
              : `${data.demo ? "Demo" : source}${data.otherCountries?.observed ? ` · +${formatCompact(data.otherCountries.observed)} elsewhere` : ""}`}
          </Caption>
        }
      />
      <KpiTile
        label="Organic share"
        value={formatPercent(organicShare, 0)}
        hint="Share of observed installs that did not come from Apple Ads: (observed − Apple Ads installs) ÷ observed"
        delta={<Caption>{t.paid > 0 ? `${formatCompact(t.paid)} paid installs` : "No Apple Ads installs"}</Caption>}
      />
      <KpiTile
        source="estimate"
        label="Installs from tracked keywords"
        value={approx(t.explained, formatEstimate)}
        hint="Modeled installs your tracked keywords brought over the period, from popularity and your rank, scaled to observed search installs when available"
        delta={<Caption>{explainedShare != null ? `${formatPercent(explainedShare, 0)} of search installs` : "Uncalibrated estimate"}</Caption>}
      />
      <KpiTile
        source="estimate"
        label="Search installs not explained"
        value={approx(t.unexplained, formatEstimate)}
        hint="Search installs that your tracked keywords cannot account for: searches you do not track yet. A high number means there are keywords to find."
        delta={<Caption>{t.unexplained == null ? "Needs install data" : "Other searches / untracked keywords"}</Caption>}
      />
      <KpiTile
        source="estimate"
        label="Revenue from tracked keywords"
        value={approx(t.keywordRevenue, formatEstimateUsd)}
        hint="Modeled installs from tracked keywords × your net revenue per new user over the period, in USD"
        delta={<Caption>{t.keywordRevenue == null ? "Connect RevenueCat or Superwall" : t.revenue != null ? `of ${formatEstimateUsd(t.revenue)} net revenue` : "Modelled estimate"}</Caption>}
      />
    </div>
  );
}

function ModeBanner({ data, onDemo }: { data: ImpactResult; onDemo: (mode: "auto" | "never") => void }) {
  if (data.demo)
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-(--tag-amber-border) bg-(--tag-amber-bg) px-4 py-3">
        <span className="flex items-center gap-2 text-(--tag-amber-text)">
          <FlaskConical aria-hidden className="size-4 shrink-0" />
          <p>{data.notice}</p>
        </span>
        <span className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => onDemo("never")}>
            Show uncalibrated estimate
          </Button>
          <Button variant="secondary" size="sm" href="/integrations">
            Set up integrations
          </Button>
        </span>
      </div>
    );
  if (!data.calibrated)
    return (
      <div className="border-border bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
        <span className="text-soft flex items-center gap-2">
          <Info aria-hidden className="size-4 shrink-0" />
          <p>Uncalibrated estimate: no observed installs are connected, so numbers come from popularity × rank alone and can be far off.</p>
        </span>
        <span className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => onDemo("auto")}>
            Show demo
          </Button>
          <Button variant="secondary" size="sm" href="/integrations">
            Connect PostHog or the SDK
          </Button>
        </span>
      </div>
    );
  return null;
}

export default function ImpactView() {
  const { app, appId, error: appError } = useCurrentApp();
  const [storedCountry, setCountry] = useAppCountry(app, { allowAll: true });
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [demo, setDemo] = useState<"auto" | "never">("auto");
  const countries = app?.countries ?? [];
  const country = storedCountry === ALL_COUNTRIES || countries.includes(storedCountry) ? storedCountry : ALL_COUNTRIES;
  const { data, error } = useApi<ImpactResult>(app ? `/api/impact?appId=${appId}&country=${country}&days=${days}&demo=${demo}` : null, { keepPreviousData: true });

  if (appError) return <EmptyState icon={TrendingUp} title="App not found" description="This app is no longer tracked." />;

  return (
    <>
      <PageHeader
        title="Keyword Impact"
        description="Which keywords bring installs and revenue? Modeled, calibrated on real installs when connected."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <CountrySelect value={country} onChange={setCountry} only={countries} allOption={{ value: ALL_COUNTRIES, label: "All countries" }} />
            <div role="radiogroup" aria-label="Period" className="bg-secondary flex h-[30px] items-center rounded-full p-0.5 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.4),inset_0px_1px_0px_0px_rgba(255,255,255,0.1)]">
              {PERIODS.map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={days === d}
                  onClick={() => setDays(d)}
                  className={cn("caption-style ease-power3-out h-full cursor-pointer rounded-full px-3 transition-colors duration-150", days === d ? "bg-muted text-foreground" : "text-subtle hover:text-soft")}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 p-4">
          {error ? (
            <ErrorBlock message={error.message} />
          ) : !data ? (
            <LoadingBlock />
          ) : (
            <>
              <ModeBanner data={data} onDemo={setDemo} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <ImpactSources sources={data.dataSources} />
                <span className="caption-style text-subtle">
                  {data.from} → {data.to} · modelled estimate
                </span>
              </div>
              {data.dataSources.errors.map((e) => (
                <p key={e} className="caption-style text-warning">
                  {e}
                </p>
              ))}
              <Tiles data={data} />
              <ImpactChart data={data} />
              <ImpactTable data={data} />
              <ImpactMap data={data} onSelect={(code) => countries.includes(code) && setCountry(code === country ? ALL_COUNTRIES : code)} />
              <ImpactMethod data={data} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
