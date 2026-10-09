"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import Tag from "@/components/_ui/tag";
import { KpiTile } from "@/components/analytics/parts";
import { PositionBadge } from "@/components/shell/score";
import { RELEVANCE_LABEL, RELEVANCE_TONE } from "@/lib/relevance/types";
import { useApi } from "@/lib/client/api";
import {
  formatCompact,
  formatMoney,
  formatPercent,
  formatUsd,
  timeAgo,
} from "@/lib/client/format";
import type {
  AdsSummary,
  ImpactSummary,
  InsightsSummary,
  OpportunitiesSummary,
  OverviewSummary,
  PosthogKpis,
  ReviewsSummary,
  TopKeyword,
} from "@/lib/dashboard/types";
import type { InsightSeverity } from "@/lib/insights/types";
import { cn } from "@/lib/utils";
import { Caption, ConnectTile, TileSkeletons } from "../kpi-tiles";
import { AbsDelta, Flag, formatScore, PctDelta } from "../parts";
import {
  Card,
  ConnectHint,
  DemoTag,
  EstimateTag,
  MoreLink,
  SkeletonRows,
  Widget,
} from "../widget";

function approx(n: number) {
  return n < 10
    ? `~${(Math.round(n * 10) / 10).toString()}`
    : `~${formatCompact(Math.round(n))}`;
}

export function OverviewKpis({ data }: { data: OverviewSummary | undefined }) {
  if (!data)
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <TileSkeletons count={6} />
      </div>
    );
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <KpiTile
        label="Visibility score"
        value={formatScore(data.visibility?.current)}
        hint="Modelled share of the search installs you'd get ranking #1 everywhere"
        delta={<AbsDelta period={data.visibility} digits={1} unit=" pts" />}
      />
      <KpiTile
        label="Avg position"
        value={
          data.avgPosition ? `#${data.avgPosition.current.toFixed(1)}` : "—"
        }
        hint="Average rank of ranked keywords"
        delta={<AbsDelta period={data.avgPosition} digits={1} invert />}
      />
      <KpiTile
        label="Top 10 / Top 3"
        value={
          data.top10
            ? `${data.top10.current} / ${data.top3?.current ?? 0}`
            : "—"
        }
        hint="Keywords ranking #1–10 and #1–3"
        delta={<AbsDelta period={data.top10} />}
      />
      <KpiTile
        label="Search installs / day"
        value={data.searchInstalls ? approx(data.searchInstalls.current) : "—"}
        hint="Estimate from popularity × tap share at your rank, 7-day average"
        delta={
          data.searchInstalls ? (
            <PctDelta period={data.searchInstalls} />
          ) : (
            <Caption>Estimate · needs rankings</Caption>
          )
        }
      />
      {data.installs ? (
        <KpiTile
          label={`Installs · 7d (${data.installs.source === "posthog" ? "PostHog" : "SDK"})`}
          value={formatCompact(data.installs.current)}
          hint="Observed installs, all countries"
          delta={<PctDelta period={data.installs} />}
        />
      ) : (
        <ConnectTile
          label="Installs · 7d"
          hint="Connect PostHog or the SDK"
          href="/integrations"
        />
      )}
      {data.revenue ? (
        <KpiTile
          label="Net revenue · 7d"
          value={formatUsd(data.revenue.current)}
          hint="RevenueCat / Superwall, all countries"
          delta={<PctDelta period={data.revenue} />}
        />
      ) : (
        <ConnectTile
          label="Net revenue · 7d"
          hint="Connect RevenueCat or Superwall"
          href="/integrations"
        />
      )}
    </div>
  );
}

export function TopKeywords({
  appId,
  country,
}: {
  appId: number;
  country: string;
}) {
  return (
    <Card
      title="Top keywords"
      description="Ranked by estimated daily search installs (popularity × tap share)."
      badge={<EstimateTag />}
      actions={
        <MoreLink href={`/apps/${appId}/keywords`}>All keywords</MoreLink>
      }
    >
      <Widget<TopKeyword[]>
        url={`/api/dashboard/apps/${appId}/keywords?country=${country}`}
        loading={<SkeletonRows rows={8} />}
      >
        {(rows) =>
          !rows.length ? (
            <ConnectHint label="Add keywords" href={`/apps/${appId}/keywords`}>
              No keywords tracked{country === "all" ? "" : " in this country"}{" "}
              yet.
            </ConnectHint>
          ) : (
            <div className="-mx-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-[13px]">
                <caption className="sr-only">Top keywords</caption>
                <thead>
                  <tr className="caption-style text-subtle text-left">
                    <th className="py-1 pl-4 font-normal">Keyword</th>
                    <th className="py-1 font-normal">Position</th>
                    <th className="py-1 font-normal">Popularity</th>
                    <th className="py-1 font-normal">Relevance</th>
                    <th className="py-1 pr-4 text-right font-normal">
                      Installs/day
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((k) => (
                    <tr key={k.id} className="border-border border-t">
                      <td className="max-w-[220px] py-1.5 pl-4">
                        <span className="flex min-w-0 items-center gap-2">
                          <Flag code={k.country} className="text-[13px]" />
                          <span className="truncate" title={k.term}>
                            {k.term}
                          </span>
                        </span>
                      </td>
                      <td className="py-1.5">
                        <PositionBadge
                          position={k.position}
                          change={k.positionChange}
                        />
                      </td>
                      <td className="py-1.5">
                        <span className="inline-flex items-center gap-1.5 tabular-nums">
                          {k.popularity == null
                            ? "—"
                            : Math.round(k.popularity)}
                          {k.popularity != null && (
                            <span
                              className={cn(
                                "caption-style",
                                k.popularitySource === "apple"
                                  ? "text-trend"
                                  : "text-faint",
                              )}
                              title={
                                k.popularitySource === "apple"
                                  ? "Apple Search Ads popularity"
                                  : "Estimated from App Store search suggestions"
                              }
                            >
                              {k.popularitySource === "apple"
                                ? "Apple"
                                : "Est."}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-1.5">
                        {k.relevanceCategory ? (
                          <span className="inline-flex items-center gap-1">
                            <Tag
                              tone={RELEVANCE_TONE[k.relevanceCategory]}
                              size="sm"
                              className="caption-style h-[20px]"
                            >
                              {RELEVANCE_LABEL[k.relevanceCategory]}
                            </Tag>
                            {!k.languageMatch && (
                              <Tag
                                tone="red"
                                size="sm"
                                className="caption-style h-[20px]"
                              >
                                Language
                              </Tag>
                            )}
                          </span>
                        ) : (
                          <span className="text-subtle">—</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-4 text-right tabular-nums">
                        {k.estInstalls ? approx(k.estInstalls) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Widget>
    </Card>
  );
}

export function ImpactCard({
  appId,
  country,
}: {
  appId: number;
  country: string;
}) {
  const { data } = useApi<ImpactSummary>(
    `/api/dashboard/apps/${appId}/impact?country=${country}`,
  );
  return (
    <Card
      title="Keyword impact"
      description="Top keywords by estimated installs and revenue, 30 days."
      badge={
        data?.demo ? (
          <DemoTag title="Synthetic installs and revenue around your keywords" />
        ) : (
          <EstimateTag />
        )
      }
      actions={<MoreLink href={`/apps/${appId}/impact`}>Impact</MoreLink>}
    >
      <Widget<ImpactSummary>
        url={`/api/dashboard/apps/${appId}/impact?country=${country}`}
        loading={<SkeletonRows rows={5} />}
      >
        {(d) =>
          !d.keywords.length ? (
            <p className="caption-style text-subtle py-4">
              No keyword impact yet. Track keywords that rank.
            </p>
          ) : (
            <ul className="flex flex-col">
              {d.keywords.map((k) => (
                <li
                  key={k.key}
                  className="border-border flex min-w-0 items-center gap-2 border-t py-1.5 text-[13px] first:border-t-0"
                >
                  <Flag code={k.country} className="text-[13px]" />
                  <span className="min-w-0 flex-1 truncate">{k.term}</span>
                  <span className="caption-style text-subtle shrink-0 tabular-nums">
                    {k.position == null ? "200+" : `#${k.position}`}
                  </span>
                  <span
                    className="w-14 shrink-0 text-right tabular-nums"
                    title="Estimated installs over 30 days"
                  >
                    {k.estDownloads ? approx(k.estDownloads) : "0"}
                  </span>
                  {d.revenueAvailable && (
                    <span
                      className="text-soft w-16 shrink-0 text-right tabular-nums"
                      title="Estimated revenue over 30 days"
                    >
                      {k.estRevenue == null
                        ? "—"
                        : k.estRevenue < 1 && k.estRevenue > 0
                          ? "<$1"
                          : formatUsd(k.estRevenue)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )
        }
      </Widget>
    </Card>
  );
}

const SEVERITY_TONE: Record<
  InsightSeverity,
  "red" | "amber" | "neutral" | "green"
> = { high: "red", medium: "amber", low: "neutral", positive: "green" };

export function InsightsCard({
  appId,
  country,
}: {
  appId: number;
  country: string;
}) {
  return (
    <Card
      title="Metadata insights"
      description="What to fix in your title and subtitle next."
      actions={
        <MoreLink href={`/apps/${appId}/suggestions`}>Suggestions</MoreLink>
      }
    >
      <Widget<InsightsSummary>
        url={`/api/dashboard/apps/${appId}/insights?country=${country}`}
        loading={<SkeletonRows rows={3} />}
      >
        {(d) =>
          !d.insights.length ? (
            <p className="caption-style text-subtle py-4">
              Nothing to fix. Your metadata covers your best keywords.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {d.insights.map((i) => (
                <li key={i.id} className="flex min-w-0 flex-col gap-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <Tag
                      tone={SEVERITY_TONE[i.severity]}
                      size="sm"
                      className="caption-style h-[20px] capitalize"
                    >
                      {i.severity}
                    </Tag>
                    <span className="truncate text-[13px]" title={i.title}>
                      {i.title}
                    </span>
                  </span>
                  <span className="caption-style text-subtle line-clamp-2">
                    {i.detail}
                  </span>
                </li>
              ))}
              {d.total > d.insights.length && (
                <li className="caption-style text-subtle">
                  +{d.total - d.insights.length} more for{" "}
                  {d.country.toUpperCase()}
                </li>
              )}
            </ul>
          )
        }
      </Widget>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="caption-style text-subtle">{label}</span>
      <span className="truncate text-[16px] font-medium tabular-nums">
        {value}
      </span>
    </div>
  );
}

export function AdsCard({ appId }: { appId: number }) {
  const { data } = useApi<AdsSummary>(`/api/dashboard/apps/${appId}/ads`);
  return (
    <Card
      title="Apple Ads · 7d"
      badge={data && "demo" in data && data.demo ? <DemoTag /> : undefined}
      actions={<MoreLink href="/apple-ads">Apple Ads</MoreLink>}
    >
      <Widget<AdsSummary>
        url={`/api/dashboard/apps/${appId}/ads`}
        loading={<SkeletonRows rows={2} />}
      >
        {(d) =>
          d.state === "disconnected" ? (
            <ConnectHint label="Connect Apple Ads" href="/apple-ads">
              See spend, installs, CPA and ROAS for this app.
            </ConnectHint>
          ) : d.state === "error" ? (
            <ConnectHint label="Check connection" href="/apple-ads">
              <span className="text-danger">{d.message}</span>
            </ConnectHint>
          ) : d.state === "no-campaigns" ? (
            <p className="caption-style text-subtle py-4">
              No campaigns promote this app.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Spend" value={formatMoney(d.spend, d.currency)} />
              <Metric label="Installs" value={formatCompact(d.installs)} />
              <Metric
                label="CPA"
                value={d.cpa == null ? "—" : formatMoney(d.cpa, d.currency)}
              />
              <Metric
                label="ROAS"
                value={d.roas == null ? "—" : `${d.roas.toFixed(2)}×`}
              />
              <span className="caption-style text-subtle col-span-2">
                {d.campaigns} campaign{d.campaigns === 1 ? "" : "s"}
              </span>
            </div>
          )
        }
      </Widget>
    </Card>
  );
}

export function FunnelCard({ appId }: { appId: number }) {
  const { data } = useApi<PosthogKpis>(
    `/api/dashboard/posthog/kpis?appId=${appId}`,
  );
  const f = data?.funnel;
  const steps = f
    ? [
        { label: "First open", users: f.start },
        { label: "Onboarding", users: f.onboarding },
        { label: "Paywall", users: f.paywall },
        { label: "Purchase", users: f.purchase },
      ].filter((s): s is { label: string; users: number } => s.users != null)
    : [];
  return (
    <Card
      title="Conversion funnel · 7d"
      badge={
        data?.mode === "demo" ? <DemoTag title={data.notice} /> : undefined
      }
      actions={
        <MoreLink href={`/analytics?tab=product&app=${appId}`}>Funnel</MoreLink>
      }
    >
      {!data ? (
        <SkeletonRows rows={4} />
      ) : data.mode === "unmapped" ? (
        <ConnectHint label="Map this app in PostHog" href="/integrations">
          Map this app to a PostHog project to see first open → paywall →
          purchase.
        </ConnectHint>
      ) : !steps.length ? (
        <p className="caption-style text-subtle py-4">
          Map install, paywall and purchase events in PostHog to build the
          funnel.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {steps.map((s) => {
            const share = steps[0].users ? s.users / steps[0].users : 0;
            return (
              <div key={s.label} className="flex flex-col gap-1">
                <span className="caption-style flex justify-between gap-2">
                  <span className="text-soft">{s.label}</span>
                  <span className="tabular-nums">
                    {formatCompact(s.users)}{" "}
                    <span className="text-subtle">
                      · {formatPercent(share, 0)}
                    </span>
                  </span>
                </span>
                <span className="bg-track/60 block h-1.5 overflow-hidden rounded-full">
                  <span
                    className="bg-trend block h-full rounded-full"
                    style={{ width: `${Math.max(2, share * 100)}%` }}
                  />
                </span>
              </div>
            );
          })}
          {data.mode === "demo" && (
            <ConnectHint
              className="py-1"
              label="Connect PostHog"
              href="/integrations"
            />
          )}
        </div>
      )}
    </Card>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden
          className={cn(
            "size-3",
            i <= Math.round(rating)
              ? "fill-warning text-warning"
              : "text-faint",
          )}
        />
      ))}
    </span>
  );
}

export function ReviewsCard({
  appId,
  country,
}: {
  appId: number;
  country: string;
}) {
  return (
    <Card
      title="Reviews"
      actions={<MoreLink href={`/apps/${appId}/reviews`}>All reviews</MoreLink>}
    >
      <Widget<ReviewsSummary>
        url={`/api/dashboard/apps/${appId}/reviews?country=${country}`}
        loading={<SkeletonRows rows={3} />}
      >
        {(d) => (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              {d.recentCount > 0 && (
                <span className="flex items-baseline gap-2">
                  <span className="text-[20px] leading-none font-medium tabular-nums">
                    {d.recentAverage == null ? "—" : d.recentAverage.toFixed(2)}
                  </span>
                  <span className="caption-style text-subtle">
                    latest {d.recentCount} in <Flag code={d.country} />
                  </span>
                </span>
              )}
              {d.storeCount ? (
                <span className="caption-style text-subtle">
                  Store {d.storeRating?.toFixed(1)} ·{" "}
                  {formatCompact(d.storeCount)} ratings
                </span>
              ) : (
                <span className="caption-style text-subtle">
                  No App Store ratings yet
                </span>
              )}
            </div>
            {!d.latest.length ? (
              <p className="caption-style text-subtle">
                No written reviews in this storefront yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {d.latest.map((r) => (
                  <li key={r.id} className="flex min-w-0 flex-col gap-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <Stars rating={r.rating} />
                      <span className="truncate text-[13px] font-medium">
                        {r.title}
                      </span>
                    </span>
                    <span className="caption-style text-soft line-clamp-2">
                      {r.content}
                    </span>
                    <span className="caption-style text-subtle">
                      {r.author} · v{r.version} · {timeAgo(r.updated)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Widget>
    </Card>
  );
}

export function OpportunitiesCard({ appId }: { appId: number }) {
  return (
    <Card
      title="Country opportunities"
      actions={<MoreLink href={`/apps/${appId}/opportunities`}>Scan</MoreLink>}
    >
      <Widget<OpportunitiesSummary>
        url={`/api/dashboard/apps/${appId}/opportunities`}
        loading={<SkeletonRows rows={3} />}
      >
        {(d) =>
          !d.top.length ? (
            <ConnectHint
              label="Run a country scan"
              href={`/apps/${appId}/opportunities`}
            >
              Find storefronts where a keyword is popular and easy to rank for.
            </ConnectHint>
          ) : (
            <div className="flex flex-col gap-2">
              <span className="caption-style text-subtle">
                “{d.term}” · scanned {timeAgo(d.scannedAt)}
              </span>
              <ul className="flex flex-col">
                {d.top.map((o) => (
                  <li
                    key={o.country}
                    className="border-border flex items-center gap-2 border-t py-1.5 text-[13px] first:border-t-0"
                  >
                    <Flag code={o.country} />
                    <span className="min-w-0 flex-1 truncate">
                      {o.country.toUpperCase()}
                    </span>
                    <span className="caption-style text-subtle tabular-nums">
                      pop {Math.round(o.popularity)} · diff{" "}
                      {Math.round(o.difficulty)}
                    </span>
                    <span className="w-8 text-right font-medium tabular-nums">
                      {o.opportunity}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        }
      </Widget>
    </Card>
  );
}

export function OverviewHeader({
  data,
}: {
  data: OverviewSummary | undefined;
}) {
  if (!data) return null;
  const a = data.app;
  return (
    <section className="bg-card border-border flex flex-wrap items-center gap-4 rounded-xl border p-4">
      {a.iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={a.iconUrl}
          alt=""
          className="size-14 shrink-0 rounded-[22%] border border-white/8 object-cover"
        />
      ) : null}
      <div className="flex min-w-[200px] flex-1 basis-0 flex-col gap-1">
        <h2 className="truncate">{a.name}</h2>
        <p className="text-soft truncate">
          {a.subtitle || (
            <span className="text-subtle">No subtitle on record</span>
          )}
        </p>
        <span className="caption-style text-subtle flex flex-wrap items-center gap-x-3 gap-y-1">
          {a.developer && <span>{a.developer}</span>}
          {a.genre && <span>{a.genre}</span>}
          {a.version && (
            <span>
              v{a.version}
              {a.versionDate ? ` · ${timeAgo(a.versionDate)}` : ""}
            </span>
          )}
          {a.ratingCount ? (
            <span className="inline-flex items-center gap-1">
              <Star aria-hidden className="fill-warning text-warning size-3" />
              {a.rating?.toFixed(1)} ({formatCompact(a.ratingCount)})
            </span>
          ) : (
            <span>No ratings yet</span>
          )}
          <span>{a.keywordCount} keywords</span>
        </span>
      </div>
      {a.url && (
        <Link
          href={a.url}
          target="_blank"
          rel="noreferrer"
          className="caption-style text-subtle hover:text-foreground shrink-0 underline-offset-2 hover:underline"
        >
          View on the App Store
        </Link>
      )}
    </section>
  );
}
