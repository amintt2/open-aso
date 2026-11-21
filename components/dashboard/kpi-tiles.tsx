"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { PlugZap } from "lucide-react";
import { KpiTile } from "@/components/analytics/parts";
import {
  formatCompact,
  formatMoney,
  formatPercent,
  formatUsd,
} from "@/lib/client/format";
import type { HomeKpis, PosthogKpis } from "@/lib/dashboard/types";
import { useApi } from "@/lib/client/api";
import { AbsDelta, formatScore, PctDelta } from "./parts";
import { DemoTag, Skeleton, WidgetError } from "./widget";

export function TileSkeletons({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          role="status"
          aria-label="Loading"
          className="bg-card border-border flex flex-col gap-3 rounded-xl border p-4"
        >
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </>
  );
}

export function ConnectTile({
  label,
  hint,
  href,
}: {
  label: string;
  hint: string;
  href: string;
}) {
  return (
    <div className="bg-card border-border flex min-w-0 flex-col gap-3 rounded-xl border border-dashed p-4">
      <span className="eyebrow-style text-subtle truncate">{label}</span>
      <span className="text-faint text-[24px] leading-none font-medium tracking-tight">
        —
      </span>
      <Link
        href={href}
        className="caption-style text-soft hover:text-foreground inline-flex items-center gap-1 transition-colors duration-150"
      >
        <PlugZap aria-hidden className="size-3" />
        {hint}
      </Link>
    </div>
  );
}

export function Caption({ children }: { children: ReactNode }) {
  return <span className="caption-style text-subtle truncate">{children}</span>;
}

function approx(n: number) {
  return n < 10
    ? `~${(Math.round(n * 10) / 10).toString()}`
    : `~${formatCompact(Math.round(n))}`;
}

export function AsoTiles({ data }: { data: HomeKpis }) {
  return (
    <>
      <KpiTile
        source="measured"
        label="Tracked keywords"
        value={formatCompact(data.trackedKeywords)}
        hint="Keyword and country pairs Open ASO checks every day, across all your apps"
        delta={
          <Caption>
            {data.addedThisWeek
              ? `+${data.addedThisWeek} added this week`
              : `${data.apps} app${data.apps === 1 ? "" : "s"}`}
          </Caption>
        }
      />
      <KpiTile
        source="measured"
        label="Keywords in top 10"
        value={data.top10 ? formatCompact(data.top10.current) : "—"}
        hint="Relevant tracked keywords where one of your apps ranks 1 to 10 in App Store search today"
        delta={<AbsDelta period={data.top10} />}
      />
      <KpiTile
        source="estimate"
        label="Search visibility · 0–100"
        value={formatScore(data.visibility?.current)}
        hint="Share of the search installs you would get if you ranked #1 for every tracked keyword. 100 means #1 everywhere. Modeled from popularity and your ranks."
        delta={<AbsDelta period={data.visibility} digits={1} unit=" pts" />}
      />
      <KpiTile
        source="estimate"
        label="Est. search installs / day"
        value={data.searchInstalls ? approx(data.searchInstalls.current) : "—"}
        hint="Modeled installs per day from tracked keywords: popularity × the share of taps your rank usually gets, averaged over 7 days. Compare with Apple's first-time downloads for the real number."
        delta={
          data.searchInstalls ? (
            <PctDelta period={data.searchInstalls} />
          ) : (
            <Caption>Estimate · needs rankings</Caption>
          )
        }
      />
    </>
  );
}

export function BusinessTiles({ data }: { data: HomeKpis }) {
  return (
    <>
      {data.revenue ? (
        <KpiTile
          source="revenue"
          label="Net revenue · 7d"
          value={formatUsd(data.revenue.current)}
          hint={`Revenue after refunds over the last 7 days, in USD, from ${data.revenue.providers.join(", ") || "webhooks"}`}
          delta={<PctDelta period={data.revenue} />}
        />
      ) : (
        <ConnectTile
          label="Net revenue · 7d"
          hint="Connect RevenueCat or Superwall"
          href="/integrations"
        />
      )}
      {data.ads ? (
        <KpiTile
          source="ads"
          label="Apple Ads spend · 7d"
          value={formatMoney(data.ads.spend.current, data.ads.currency)}
          hint="Apple Ads spend over the last 7 days. ROAS = revenue ÷ spend, CPA = spend ÷ installs."
          delta={
            <span className="caption-style text-subtle truncate">
              ROAS{" "}
              {data.ads.roas == null ? "—" : `${data.ads.roas.toFixed(2)}×`} ·
              CPA{" "}
              {data.ads.cpa == null
                ? "—"
                : formatMoney(data.ads.cpa, data.ads.currency)}
            </span>
          }
        />
      ) : data.adsError ? (
        <ConnectTile
          label="Apple Ads · 7d"
          hint="Connection error, check it"
          href="/apple-ads"
        />
      ) : (
        <ConnectTile
          label="Apple Ads · 7d"
          hint="Connect Apple Ads"
          href="/apple-ads"
        />
      )}
    </>
  );
}

export function PosthogTiles({ data }: { data: PosthogKpis }) {
  if (data.mode === "unmapped")
    return (
      <>
        <ConnectTile
          label="First opens today"
          hint="Map this app in PostHog"
          href="/integrations"
        />
        <ConnectTile
          label="First opens · 7d"
          hint="Map this app in PostHog"
          href="/integrations"
        />
        <ConnectTile
          label="Daily active users"
          hint="Map this app in PostHog"
          href="/integrations"
        />
        <ConnectTile
          label="New user → purchase"
          hint="Map this app in PostHog"
          href="/integrations"
        />
      </>
    );
  const f = data.funnel;
  return (
    <>
      <KpiTile
        source="posthog"
        label="First opens today"
        value={formatCompact(data.newUsersToday)}
        hint="Devices that opened the app for the first time since midnight UTC. Includes test and App Review devices, so Apple's first-time downloads stay the reference."
        delta={
          <PctDelta
            period={{
              current: data.newUsersToday,
              previous: data.newUsersYesterday,
            }}
            suffix="vs yesterday"
          />
        }
      />
      <KpiTile
        source="posthog"
        label="First opens · 7d"
        value={formatCompact(data.newUsers.current)}
        hint="Devices that opened the app for the first time in the last 7 days. Includes test and App Review devices, so Apple's first-time downloads stay the reference."
        delta={<PctDelta period={data.newUsers} />}
      />
      <KpiTile
        source="posthog"
        label="Daily active users"
        value={formatCompact(data.dau)}
        hint="Average number of distinct users who opened the app per day over the last 7 days"
        delta={<Caption>7-day average</Caption>}
      />
      <KpiTile
        source="posthog"
        label="New user → purchase"
        value={formatPercent(f?.overall ?? null)}
        hint="Share of new users who made a purchase within 7 days of their first open"
        delta={
          <span className="caption-style text-subtle truncate">
            {f
              ? `→ paywall ${formatPercent(f.toPaywall, 0)} · → buy ${formatPercent(f.toPurchase, 0)}`
              : "Map funnel events"}
          </span>
        }
      />
    </>
  );
}

export function PosthogRow({ appId }: { appId?: number }) {
  const { data, error } = useApi<PosthogKpis>(
    `/api/dashboard/posthog/kpis${appId ? `?appId=${appId}` : ""}`,
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="eyebrow-style text-subtle">In the app · counted by PostHog</h2>
        <span className="caption-style text-subtle">
          Includes test and App Review devices
        </span>
        {data?.mode === "demo" && <DemoTag title={data.notice} />}
        {data?.mode === "demo" && (
          <Link
            href="/integrations"
            className="caption-style text-soft hover:text-foreground inline-flex items-center gap-1"
          >
            <PlugZap aria-hidden className="size-3" />
            Connect PostHog
          </Link>
        )}
        {data?.errors.map((e) => (
          <span
            key={e}
            className="caption-style text-warning truncate"
            title={e}
          >
            {e}
          </span>
        ))}
      </div>
      {error && !data ? (
        <WidgetError message={error.message} />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {data ? <PosthogTiles data={data} /> : <TileSkeletons count={4} />}
        </div>
      )}
    </div>
  );
}
