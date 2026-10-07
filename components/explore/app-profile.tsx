"use client";

import { useState, type ReactNode } from "react";
import { ExternalLink, Loader2, SearchX, Star } from "lucide-react";
import { buttonVariants } from "@/components/_ui/button";
import Tag from "@/components/_ui/tag";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import AppIcon from "@/components/shell/app-icon";
import EmptyState from "@/components/shell/empty-state";
import { COUNTRY_BY_CODE } from "@/lib/appstore/countries";
import { useApi } from "@/lib/client/api";
import { formatCompact, formatUsd, timeAgo } from "@/lib/client/format";
import { artworkUrl, formatBytes, formatDate } from "@/lib/explore/format";
import type { ExploreAppDetail } from "@/lib/explore/types";
import CountryPresence from "./country-presence";
import ExpandableText from "./expandable-text";
import RankingKeywordsTable from "./ranking-keywords-table";
import Screenshots from "./screenshots";
import SimilarApps from "./similar-apps";
import Stat from "./stat";

export type ProfileTab = { value: string; label: string; content: ReactNode };

type Props = {
  trackId: number;
  country: string;
  onCountryChange?: (code: string) => void;
  actions?: (detail: ExploreAppDetail) => ReactNode;
  extraTabs?: ProfileTab[];
  defaultTab?: string;
  targetAppId?: number;
  targetAppName?: string;
  excludeTrackIds?: number[];
};

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-border flex items-baseline justify-between gap-4 border-b py-2.5 last:border-b-0">
      <dt className="caption-style text-subtle shrink-0">{label}</dt>
      <dd className="min-w-0 truncate text-right text-[14px]">{value}</dd>
    </div>
  );
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="h2-style">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Overview({ detail }: { detail: ExploreAppDetail }) {
  const { app } = detail;
  return (
    <div className="grid gap-8 p-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-8">
        <Section title="Screenshots">
          <Screenshots iphone={app.screenshotUrls} ipad={app.ipadScreenshotUrls} />
        </Section>
        <Section title="Description">
          <ExpandableText text={app.description} lines={8} />
        </Section>
        <Section title="What's new" aside={<span className="caption-style text-subtle">Version {app.version} · {formatDate(app.currentVersionReleaseDate)}</span>}>
          {app.releaseNotes ? <ExpandableText text={app.releaseNotes} lines={5} /> : <p className="text-subtle">No release notes for this version.</p>}
        </Section>
      </div>
      <Section title="Information">
        <dl className="bg-card border-border flex flex-col rounded-lg border px-3">
          <InfoRow label="Seller" value={app.sellerName} />
          <InfoRow label="Category" value={app.genres.join(", ") || app.primaryGenreName} />
          <InfoRow label="Size" value={formatBytes(app.fileSizeBytes)} />
          <InfoRow label="Age rating" value={app.contentAdvisoryRating || "—"} />
          <InfoRow label="Requires" value={app.minimumOsVersion ? `iOS ${app.minimumOsVersion}+` : "—"} />
          <InfoRow label="Languages" value={app.languageCodesISO2A?.length ? `${app.languageCodesISO2A.length} languages` : "—"} />
          <InfoRow label="Released" value={formatDate(app.releaseDate)} />
          <InfoRow label="Bundle ID" value={<span className="font-mono text-[12px]">{app.bundleId}</span>} />
          <InfoRow label="App ID" value={<span className="tabular-nums">{app.trackId}</span>} />
        </dl>
      </Section>
    </div>
  );
}

export default function AppProfile({ trackId, country, onCountryChange, actions, extraTabs = [], defaultTab, targetAppId, targetAppName, excludeTrackIds }: Props) {
  const { data, error, isLoading } = useApi<ExploreAppDetail>(`/api/explore/${trackId}?country=${country}`);
  const [tab, setTab] = useState(defaultTab ?? extraTabs[0]?.value ?? "overview");
  const countryName = COUNTRY_BY_CODE.get(country)?.name ?? country.toUpperCase();

  if (isLoading)
    return (
      <div role="status" className="text-subtle flex flex-1 items-center justify-center gap-2 py-20">
        <Loader2 aria-hidden className="size-4 animate-spin" /> Loading app…
      </div>
    );

  if (error || !data)
    return (
      <EmptyState
        icon={SearchX}
        title={`Not available in ${countryName}`}
        description={error instanceof Error ? error.message : "This app could not be loaded. Try another storefront."}
      />
    );

  const { app } = data;

  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-start">
        <AppIcon src={artworkUrl(app.artworkUrl512 ?? app.artworkUrl100, 256)} name={app.trackName} className="size-[88px]" />
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <h2 className="break-words">{app.trackName}</h2>
          <p className="text-soft truncate">{app.sellerName}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag tone="blue" size="sm" className="text-[12px]">
              {app.primaryGenreName}
            </Tag>
            <Tag tone={app.price > 0 ? "amber" : "green"} size="sm" className="text-[12px]">
              {app.price > 0 ? (app.formattedPrice ?? `${app.price} ${app.currency}`) : "Free"}
            </Tag>
            {app.contentAdvisoryRating && (
              <Tag tone="neutral" size="sm" className="text-[12px]">
                {app.contentAdvisoryRating}
              </Tag>
            )}
            <span className="caption-style text-subtle ml-1 inline-flex items-center gap-1">
              <Star aria-hidden className="text-warning size-3 fill-current" />
              {app.averageUserRating ? app.averageUserRating.toFixed(1) : "—"} · {formatCompact(app.userRatingCount)} ratings in {countryName}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions?.(data)}
          <a href={app.trackViewUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "secondary", size: "md" })}>
            <ExternalLink aria-hidden className="size-3.5" />
            App Store
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 px-4 pb-4 sm:grid-cols-3 xl:grid-cols-6">
        <Stat label="Rating" value={app.averageUserRating ? `★ ${app.averageUserRating.toFixed(2)}` : "—"} hint={`${formatCompact(app.userRatingCount)} ratings`} />
        <Stat label="Monthly downloads" value={formatCompact(data.downloadsEst)} hint="Estimate" />
        <Stat label="Monthly revenue" value={formatUsd(data.revenueEst)} hint="Estimate" />
        <Stat label="Version" value={app.version} hint={formatDate(app.currentVersionReleaseDate)} />
        <Stat label="Last update" value={timeAgo(app.currentVersionReleaseDate)} hint={formatDate(app.currentVersionReleaseDate)} />
        <Stat label="Released" value={formatDate(app.releaseDate)} hint={timeAgo(app.releaseDate)} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="border-border overflow-x-auto border-b px-4">
          {extraTabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="keywords">Ranking keywords</TabsTrigger>
          <TabsTrigger value="countries">Country presence</TabsTrigger>
          <TabsTrigger value="similar">Similar apps</TabsTrigger>
        </TabsList>
        {extraTabs.map((t) => (
          <TabsContent key={t.value} value={t.value}>
            {t.content}
          </TabsContent>
        ))}
        <TabsContent value="overview">
          <Overview detail={data} />
        </TabsContent>
        <TabsContent value="keywords">
          <RankingKeywordsTable trackId={trackId} country={country} targetAppId={targetAppId} targetAppName={targetAppName} excludeTrackIds={excludeTrackIds ?? [trackId]} />
        </TabsContent>
        <TabsContent value="countries">
          <CountryPresence trackId={trackId} country={country} onSelectCountry={onCountryChange} />
        </TabsContent>
        <TabsContent value="similar">
          <SimilarApps trackId={trackId} country={country} developer={app.sellerName} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
