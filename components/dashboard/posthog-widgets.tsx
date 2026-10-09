"use client";

import { useState } from "react";
import { Activity, FlaskConical } from "lucide-react";
import Tag from "@/components/_ui/tag";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import AppIcon from "@/components/shell/app-icon";
import WorldMap from "@/components/shell/world-map";
import { Segmented } from "@/components/trends/visibility-chart";
import { COUNTRY_BY_CODE } from "@/lib/appstore/countries";
import { useApi } from "@/lib/client/api";
import {
  formatCompact,
  formatPercent,
  formatUsd,
  timeAgo,
} from "@/lib/client/format";
import type { TrackedApp } from "@/lib/client/types";
import type {
  ExperimentResult,
  ExperimentsResult,
  GeoResult,
  LiveResult,
  PosthogScope,
  Significance,
} from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";
import { Flag, PctDelta } from "./parts";
import {
  Card,
  ConnectHint,
  DemoTag,
  MoreLink,
  Skeleton,
  SkeletonRows,
  WidgetError,
} from "./widget";

const PERIODS = [
  { key: "7", label: "7d" },
  { key: "30", label: "30d" },
] as const;

function query(
  appId: number | null | undefined,
  extra: Record<string, string> = {},
) {
  const params = new URLSearchParams(extra);
  if (appId) params.set("appId", String(appId));
  const s = params.toString();
  return s ? `?${s}` : "";
}

function ScopeBadge({ scope }: { scope?: PosthogScope }) {
  if (!scope) return null;
  return scope.mode === "demo" ? <DemoTag title={scope.notice} /> : null;
}

function Unmapped({ appId }: { appId?: number | null }) {
  return (
    <ConnectHint
      label={appId ? "Map this app in PostHog" : "Map your apps in PostHog"}
      href="/integrations"
    >
      PostHog is connected, but {appId ? "this app isn't" : "no app is"} mapped
      to a PostHog project yet.
    </ConnectHint>
  );
}

function Errors({ scope }: { scope?: PosthogScope }) {
  if (!scope?.errors.length) return null;
  return (
    <ul className="flex flex-col gap-1">
      {scope.errors.map((e) => (
        <li key={e} className="caption-style text-warning truncate" title={e}>
          {e}
        </li>
      ))}
    </ul>
  );
}

function AppFilter({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const { data: apps = [] } = useApi<TrackedApp[]>("/api/apps");
  return (
    <Select
      value={value ? String(value) : "all"}
      onValueChange={(v) => onChange(v === "all" ? null : Number(v))}
    >
      <SelectTrigger
        aria-label="App"
        className="h-[30px] w-auto max-w-[200px] min-w-[140px] rounded-full text-[13px]"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All mapped apps</SelectItem>
        {apps.map((a) => (
          <SelectItem key={a.id} value={String(a.id)}>
            {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DownloadsMap({
  appId,
  filterable = false,
}: {
  appId?: number;
  filterable?: boolean;
}) {
  const [days, setDays] = useState<"7" | "30">("7");
  const [selectedApp, setSelectedApp] = useState<number | null>(null);
  const scopeApp = appId ?? selectedApp;
  const { data, error } = useApi<GeoResult>(
    `/api/dashboard/posthog/geo${query(scopeApp, { days })}`,
    { keepPreviousData: true },
  );
  const values = Object.fromEntries(
    (data?.countries ?? [])
      .filter((c) => c.newUsers > 0)
      .map((c) => [c.country, c.newUsers]),
  );
  const top = (data?.countries ?? []).slice(0, 8);
  return (
    <Card
      title="Downloads by country"
      description={`New users per country from PostHog, last ${days} days vs the ${days} days before.`}
      badge={<ScopeBadge scope={data} />}
      actions={
        <>
          {filterable && data?.mode !== "demo" && (
            <AppFilter value={selectedApp} onChange={setSelectedApp} />
          )}
          <Segmented
            label="Period"
            value={days}
            options={[...PERIODS]}
            onChange={setDays}
          />
        </>
      }
    >
      {error && !data ? (
        <WidgetError message={error.message} />
      ) : !data ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Skeleton className="aspect-2/1 w-full" />
          <SkeletonRows rows={6} />
        </div>
      ) : data.mode === "unmapped" ? (
        <Unmapped appId={scopeApp} />
      ) : (
        <>
          <Errors scope={data} />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <WorldMap
              values={values}
              format={(v) => `${formatCompact(v)} new users`}
              legend="New users"
            />
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[20px] leading-none font-medium tabular-nums">
                  {formatCompact(data.total)}
                </span>
                <PctDelta
                  period={{ current: data.total, previous: data.previousTotal }}
                  suffix={`vs prior ${days}d`}
                />
              </div>
              {!top.length ? (
                <p className="caption-style text-subtle py-4">
                  No new users in this period.
                </p>
              ) : (
                <table className="w-full text-[13px]">
                  <caption className="sr-only">
                    Top countries by new users
                  </caption>
                  <thead>
                    <tr className="caption-style text-subtle text-left">
                      <th className="py-1 font-normal">Country</th>
                      <th className="py-1 text-right font-normal">New users</th>
                      <th className="py-1 text-right font-normal">Δ</th>
                      {data.revenueAvailable && (
                        <th className="py-1 text-right font-normal">Revenue</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {top.map((c) => {
                      const change = c.previous
                        ? (c.newUsers - c.previous) / c.previous
                        : null;
                      return (
                        <tr key={c.country} className="border-border border-t">
                          <td className="py-1.5">
                            <span className="flex min-w-0 items-center gap-2">
                              <Flag code={c.country} />
                              <span className="truncate">
                                {COUNTRY_BY_CODE.get(c.country)?.name ??
                                  c.country.toUpperCase()}
                              </span>
                            </span>
                          </td>
                          <td className="py-1.5 text-right tabular-nums">
                            {formatCompact(c.newUsers)}
                          </td>
                          <td
                            className={cn(
                              "caption-style py-1.5 text-right tabular-nums",
                              change == null
                                ? "text-subtle"
                                : change > 0.005
                                  ? "text-trend"
                                  : change < -0.005
                                    ? "text-danger"
                                    : "text-subtle",
                            )}
                          >
                            {change == null
                              ? "new"
                              : `${change > 0 ? "+" : ""}${Math.round(change * 100)}%`}
                          </td>
                          {data.revenueAvailable && (
                            <td className="py-1.5 text-right tabular-nums">
                              {c.revenue == null ? "—" : formatUsd(c.revenue)}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {data.mode === "demo" && (
                <ConnectHint
                  className="py-1"
                  label="Connect PostHog"
                  href="/integrations"
                />
              )}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

export function LiveEvents({ appId }: { appId?: number }) {
  const { data, error } = useApi<LiveResult>(
    `/api/dashboard/posthog/live${query(appId)}`,
    { refreshInterval: 30_000, keepPreviousData: true },
  );
  return (
    <Card
      title={
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full",
              data?.mode === "live" ? "bg-success animate-pulse" : "bg-faint",
            )}
          />
          Live events
        </span>
      }
      badge={<ScopeBadge scope={data} />}
      actions={
        <MoreLink
          href={`/analytics?tab=product${appId ? `&app=${appId}` : ""}`}
        >
          Product analytics
        </MoreLink>
      }
    >
      {error && !data ? (
        <WidgetError message={error.message} />
      ) : !data ? (
        <SkeletonRows rows={6} />
      ) : data.mode === "unmapped" ? (
        <Unmapped appId={appId} />
      ) : !data.events.length ? (
        <p className="caption-style text-subtle flex items-center gap-2 py-6">
          <Activity aria-hidden className="size-4" />
          No events in the last 7 days.
        </p>
      ) : (
        <>
          <Errors scope={data} />
          <ul className="flex flex-col" aria-live="polite">
            {data.events.map((e) => (
              <li
                key={e.id}
                className="border-border flex min-w-0 items-center gap-2 border-t py-1.5 first:border-t-0"
              >
                <span
                  className="caption-style text-subtle w-14 shrink-0 tabular-nums"
                  title={e.timestamp}
                >
                  {timeAgo(e.timestamp)}
                </span>
                {!appId && e.app && (
                  <AppIcon
                    src={e.app.iconUrl}
                    name={e.app.appName}
                    className="size-5"
                  />
                )}
                <span
                  className="min-w-0 flex-1 truncate font-mono text-[12px]"
                  title={e.event}
                >
                  {e.canonical}
                </span>
                {e.country && <Flag code={e.country} className="text-[13px]" />}
                {e.version && (
                  <span className="caption-style text-subtle shrink-0 tabular-nums">
                    v{e.version}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="caption-style text-subtle">
            Refreshes every 30 seconds
            {data.mode === "demo" ? " · demo events" : ""}.
          </p>
        </>
      )}
    </Card>
  );
}

const SIG: Record<
  Significance,
  { label: string; tone: "green" | "red" | "neutral" | "amber" | "blue" }
> = {
  winner: { label: "Likely winner", tone: "green" },
  loser: { label: "Worse", tone: "red" },
  "not-significant": { label: "Not significant yet", tone: "neutral" },
  control: { label: "Control", tone: "blue" },
  insufficient: { label: "Too few users", tone: "amber" },
};

function Experiment({
  exp,
  showApp,
}: {
  exp: ExperimentResult;
  showApp: boolean;
}) {
  return (
    <div className="border-border flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <FlaskConical aria-hidden className="text-subtle size-3.5 shrink-0" />
          <span className="truncate font-mono text-[12px]">{exp.flag}</span>
          {showApp && exp.app && (
            <span className="caption-style text-subtle truncate">
              · {exp.app.appName}
            </span>
          )}
        </span>
        <span className="caption-style text-subtle tabular-nums">
          {formatCompact(exp.users)} exposed
        </span>
      </div>
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[420px] text-[13px]">
          <thead>
            <tr className="caption-style text-subtle text-left">
              <th className="px-1 py-1 font-normal">Variant</th>
              <th className="px-1 py-1 text-right font-normal">Users</th>
              <th className="px-1 py-1 text-right font-normal">Paywall</th>
              <th className="px-1 py-1 text-right font-normal">Purchase</th>
              <th className="px-1 py-1 text-right font-normal">Uplift</th>
              <th className="px-1 py-1 text-right font-normal">Result</th>
            </tr>
          </thead>
          <tbody>
            {exp.variants.map((v) => (
              <tr key={v.variant} className="border-border border-t">
                <td className="max-w-[140px] truncate px-1 py-1.5">
                  {v.variant}
                </td>
                <td className="px-1 py-1.5 text-right tabular-nums">
                  {formatCompact(v.users)}
                </td>
                <td className="px-1 py-1.5 text-right tabular-nums">
                  {formatPercent(v.paywallRate)}
                </td>
                <td className="px-1 py-1.5 text-right tabular-nums">
                  {formatPercent(v.purchaseRate)}
                </td>
                <td
                  className={cn(
                    "px-1 py-1.5 text-right tabular-nums",
                    v.uplift == null
                      ? "text-subtle"
                      : v.uplift > 0
                        ? "text-trend"
                        : "text-danger",
                  )}
                >
                  {v.uplift == null
                    ? "—"
                    : `${v.uplift > 0 ? "+" : ""}${Math.round(v.uplift * 100)}%`}
                </td>
                <td className="px-1 py-1.5 text-right">
                  <Tag
                    tone={SIG[v.significance].tone}
                    size="sm"
                    className="caption-style h-[20px]"
                    title={
                      v.pValue == null
                        ? undefined
                        : `p = ${v.pValue.toFixed(3)} (two-proportion z-test)`
                    }
                  >
                    {SIG[v.significance].label}
                  </Tag>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="caption-style text-soft">{exp.verdict}</p>
    </div>
  );
}

export function Experiments({
  appId,
  limit,
}: {
  appId?: number;
  limit?: number;
}) {
  const { data, error } = useApi<ExperimentsResult>(
    `/api/dashboard/posthog/experiments${query(appId, limit ? { limit: String(limit) } : {})}`,
  );
  return (
    <Card
      title="Experiments"
      description="Feature flag variants over 30 days, compared with control using a two-proportion z-test (p < 0.05)."
      badge={<ScopeBadge scope={data} />}
      actions={
        <MoreLink
          href={`/analytics?tab=product${appId ? `&app=${appId}` : ""}`}
        >
          All results
        </MoreLink>
      }
    >
      {error && !data ? (
        <WidgetError message={error.message} />
      ) : !data ? (
        <SkeletonRows rows={5} />
      ) : data.mode === "unmapped" ? (
        <Unmapped appId={appId} />
      ) : !data.experiments.length ? (
        <p className="caption-style text-subtle py-6">
          No feature flag exposures with more than one variant in the last 30
          days.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <Errors scope={data} />
          {data.experiments.map((e) => (
            <Experiment
              key={`${e.app?.appName}-${e.flag}`}
              exp={e}
              showApp={!appId}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
