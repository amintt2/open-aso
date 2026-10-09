import { listApps } from "@/lib/aso/apps";
import { appCatalog, listMappings } from "@/lib/posthog/apps";
import {
  isPosthogConfigured,
  num,
  runHogQL,
  text,
  isoTime,
} from "@/lib/posthog/client";
import {
  DEMO_APPS,
  POSTHOG_DEMO_NOTICE,
  demoApp,
  demoCountriesRows,
} from "@/lib/posthog/demo";
import { canonicalEvent, roleEvents } from "@/lib/posthog/events";
import { liveEventsQuery } from "@/lib/posthog/hogql";
import {
  getPosthogEvents,
  getPosthogExperiments,
  getPosthogFunnel,
  getPosthogGeography,
  getPosthogNewUsers,
  getPosthogOverview,
  type PosthogQuery,
} from "@/lib/posthog/queries";
import type { ExperimentRow, PosthogFunnelResult } from "@/lib/posthog/types";
import { cached, wsKey } from "@/lib/server/cache";
import { db } from "@/lib/server/db";
import { countryPeriodsQuery } from "./hogql";
import { twoProportionTest } from "./stats";
import { appRef } from "./trends";
import type {
  AppRef,
  ExperimentResult,
  ExperimentsResult,
  ExperimentVariant,
  FunnelSnapshot,
  GeoCountry,
  GeoResult,
  LiveEventRow,
  LiveResult,
  PosthogKpis,
  PosthogScope,
} from "./types";

const TTL = 5 * 60 * 1000;
const LIVE_TTL = 25 * 1000;
const LIVE_LIMIT = 15;
const MIN_USERS = 30;
const ALPHA = 0.05;

type Target = { query: PosthogQuery; ref: AppRef; slug: string | null };
type Resolved = { mode: PosthogScope["mode"]; targets: Target[] };

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function demoTargets(appId: number | null): Target[] {
  const list = appId == null ? DEMO_APPS : [demoApp(null)];
  return list.map((cfg) => ({
    query: { demo: cfg.slug },
    ref: { appId: 0, appName: `${cfg.name} (demo)`, iconUrl: null },
    slug: cfg.slug,
  }));
}

async function resolve(
  workspaceId: string,
  appId: number | null,
): Promise<Resolved> {
  if (!(await isPosthogConfigured(workspaceId)))
    return { mode: "demo", targets: demoTargets(appId) };
  const [mappings, apps] = await Promise.all([
    listMappings(workspaceId),
    listApps(workspaceId),
  ]);
  const mapped = new Set(mappings.map((m) => m.appId));
  const targets = apps
    .filter((a) => mapped.has(a.id) && (appId == null || a.id === appId))
    .map((a) => ({ query: { appId: a.id }, ref: appRef(a), slug: null }));
  return { mode: targets.length ? "live" : "unmapped", targets };
}

function scopeOf(r: Resolved, errors: string[]): PosthogScope {
  return {
    mode: r.mode,
    notice: r.mode === "demo" ? POSTHOG_DEMO_NOTICE : null,
    apps: r.targets.map((t) => t.ref),
    errors,
  };
}

async function settle<T>(targets: Target[], run: (t: Target) => Promise<T>) {
  const errors: string[] = [];
  const results: { target: Target; value: T }[] = [];
  await Promise.all(
    targets.map(async (target) => {
      try {
        results.push({ target, value: await run(target) });
      } catch (error) {
        errors.push(`${target.ref.appName}: ${message(error)}`);
      }
    }),
  );
  results.sort((a, b) => targets.indexOf(a.target) - targets.indexOf(b.target));
  return { results, errors };
}

const key = (workspaceId: string, name: string, appId: number | null) =>
  wsKey(workspaceId, `dashboard:posthog:${name}:${appId ?? "all"}`);

function funnelOf(results: PosthogFunnelResult[]): FunnelSnapshot | null {
  const total = (role: string) => {
    const values = results
      .map((r) => r.steps.find((s) => s.role === role)?.users)
      .filter((v): v is number => v != null);
    return values.length ? values.reduce((a, b) => a + b, 0) : null;
  };
  const start = results.reduce((s, r) => s + (r.steps[0]?.users ?? 0), 0);
  if (!results.some((r) => r.steps.length)) return null;
  const onboarding = total("onboarding_start") ?? total("onboarding_complete");
  const paywall = total("paywall_view");
  const purchase = total("purchase_success");
  const ratio = (a: number | null, b: number | null) =>
    a != null && b ? a / b : null;
  return {
    onboarding,
    paywall,
    purchase,
    start,
    toPaywall: ratio(paywall, onboarding ?? start),
    toPurchase: ratio(purchase, paywall),
    overall: ratio(purchase, start),
  };
}

export function getPosthogKpis(
  workspaceId: string,
  appId: number | null,
): Promise<PosthogKpis> {
  return cached(key(workspaceId, "kpis", appId), TTL, async () => {
    const r = await resolve(workspaceId, appId);
    const { results, errors } = await settle(r.targets, async (t) => {
      const q = { ...t.query, days: 7 };
      const [users, overview, funnel] = await Promise.all([
        getPosthogNewUsers(workspaceId, q),
        getPosthogOverview(workspaceId, q),
        getPosthogFunnel(workspaceId, q),
      ]);
      return { users, overview, funnel };
    });
    const sumAt = (offset: number) =>
      results.reduce(
        (s, x) =>
          s +
          (x.value.users.series[x.value.users.series.length - 1 - offset]
            ?.newUsers ?? 0),
        0,
      );
    return {
      ...scopeOf(r, errors),
      newUsersToday: sumAt(0),
      newUsersYesterday: sumAt(1),
      newUsers: {
        current: results.reduce((s, x) => s + x.value.users.total, 0),
        previous: results.reduce((s, x) => s + x.value.users.previousTotal, 0),
      },
      dau: Math.round(
        results.reduce((s, x) => s + x.value.overview.totals.dauAverage, 0),
      ),
      funnel: funnelOf(results.map((x) => x.value.funnel)),
    };
  });
}

async function revenueByCountry(
  workspaceId: string,
  appId: number | null,
  days: number,
) {
  const rows = await db.all<{ country: string; revenue: number }>(
    `SELECT lower(country) AS country, SUM(amount_usd) AS revenue FROM revenue_events
     WHERE workspace_id = ? AND country IS NOT NULL AND type NOT IN ('test','other') AND COALESCE(raw ->> 'environment', '') != 'SANDBOX'
       AND (CAST(? AS bigint) IS NULL OR app_id = CAST(? AS bigint)) AND occurred_at >= current_date - CAST(? AS integer) + 1
     GROUP BY 1`,
    [workspaceId, appId, appId, days],
  );
  return rows.length ? new Map(rows.map((r) => [r.country, r.revenue])) : null;
}

async function countryPeriods(workspaceId: string, t: Target, days: number) {
  if (t.slug) {
    const geo = await getPosthogGeography(workspaceId, { ...t.query, days });
    const wide = demoCountriesRows(t.slug, geo.roles, days * 2);
    const current = new Map(geo.countries.map((c) => [c.country, c.newUsers]));
    return wide.map((w) => {
      const code = String(w.country).toLowerCase();
      const now = current.get(code) ?? 0;
      return {
        country: code,
        current: now,
        previous: Math.max(0, w.new_users - now),
      };
    });
  }
  const catalog = await appCatalog(workspaceId, t.query.appId as number);
  const roles = roleEvents(catalog.roles);
  const res = await runHogQL<Record<string, unknown>>(
    workspaceId,
    countryPeriodsQuery(
      { bundleId: catalog.app.bundleId, prefix: catalog.app.prefix },
      roles.install,
      days,
    ),
  );
  return res.rows.map((row) => ({
    country: (text(row.country) ?? "").toLowerCase(),
    current: num(row.current),
    previous: num(row.previous),
  }));
}

export function getPosthogGeo(
  workspaceId: string,
  appId: number | null,
  days: 7 | 30,
): Promise<GeoResult> {
  return cached(key(workspaceId, `geo:${days}`, appId), TTL, async () => {
    const r = await resolve(workspaceId, appId);
    const [{ results, errors }, revenue] = await Promise.all([
      settle(r.targets, (t) => countryPeriods(workspaceId, t, days)),
      r.mode === "live"
        ? revenueByCountry(workspaceId, appId, days).catch(() => null)
        : Promise.resolve(null),
    ]);
    const merged = new Map<string, GeoCountry>();
    for (const { value } of results)
      for (const row of value) {
        if (!/^[a-z]{2}$/.test(row.country)) continue;
        const entry = merged.get(row.country) ?? {
          country: row.country,
          newUsers: 0,
          previous: 0,
          revenue: null,
        };
        entry.newUsers += row.current;
        entry.previous += row.previous;
        merged.set(row.country, entry);
      }
    if (revenue)
      for (const [country, amount] of revenue)
        merged.set(country, {
          ...(merged.get(country) ?? { country, newUsers: 0, previous: 0 }),
          revenue: amount,
        });
    const countries = [...merged.values()]
      .filter((c) => c.newUsers || c.previous || c.revenue)
      .sort((a, b) => b.newUsers - a.newUsers || b.previous - a.previous);
    return {
      ...scopeOf(r, errors),
      days,
      total: countries.reduce((s, c) => s + c.newUsers, 0),
      previousTotal: countries.reduce((s, c) => s + c.previous, 0),
      revenueAvailable: !!revenue,
      countries,
    };
  });
}

async function liveRows(
  workspaceId: string,
  t: Target,
): Promise<LiveEventRow[]> {
  if (t.slug) {
    const res = await getPosthogEvents(workspaceId, { ...t.query, days: 7 });
    return res.events
      .slice(0, LIVE_LIMIT)
      .map((e, i) => ({
        id: `${t.slug}-${e.timestamp}-${i}`,
        timestamp: e.timestamp,
        event: e.event,
        canonical: e.canonical,
        country: e.country,
        version: e.version,
        app: t.ref,
      }));
  }
  const catalog = await appCatalog(workspaceId, t.query.appId as number);
  const scope = { bundleId: catalog.app.bundleId, prefix: catalog.app.prefix };
  const res = await runHogQL<Record<string, unknown>>(
    workspaceId,
    liveEventsQuery(scope, 7),
    { ttlMs: LIVE_TTL },
  );
  return res.rows.slice(0, LIVE_LIMIT).map((row, i) => {
    const event = text(row.event) ?? "";
    const country = (text(row.country) ?? "").toLowerCase();
    return {
      id: `${t.ref.appId}-${text(row.timestamp)}-${i}`,
      timestamp: isoTime(row.timestamp) ?? "",
      event,
      canonical: canonicalEvent(event, scope.prefix),
      country: /^[a-z]{2}$/.test(country) ? country : null,
      version: text(row.version),
      app: t.ref,
    };
  });
}

export function getPosthogLive(
  workspaceId: string,
  appId: number | null,
): Promise<LiveResult> {
  return cached(key(workspaceId, "live", appId), LIVE_TTL, async () => {
    const r = await resolve(workspaceId, appId);
    const { results, errors } = await settle(r.targets, (t) =>
      liveRows(workspaceId, t),
    );
    const events = results
      .flatMap((x) => x.value)
      .sort((a, b) =>
        a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0,
      )
      .slice(0, LIVE_LIMIT);
    return {
      ...scopeOf(r, errors),
      fetchedAt: new Date().toISOString(),
      events,
    };
  });
}

function judge(exp: ExperimentRow, app: AppRef | null): ExperimentResult {
  const hasPurchase = exp.variants.some((v) => v.purchaseRate != null);
  const hasPaywall = exp.variants.some((v) => v.paywallRate != null);
  const metric: ExperimentResult["metric"] = hasPurchase
    ? "purchase"
    : hasPaywall
      ? "paywall"
      : null;
  const hits = (v: ExperimentRow["variants"][number]) =>
    metric === "purchase" ? v.purchaseUsers : v.paywallUsers;
  const control =
    exp.variants.find((v) => v.variant === "control") ?? exp.variants[0];
  const variants: ExperimentVariant[] = exp.variants.map((v) => {
    const base = {
      variant: v.variant,
      users: v.users,
      paywallRate: v.paywallRate,
      purchaseRate: v.purchaseRate,
    };
    if (v === control)
      return { ...base, uplift: null, pValue: null, significance: "control" };
    if (!metric || !control)
      return {
        ...base,
        uplift: null,
        pValue: null,
        significance: "insufficient",
      };
    const test = twoProportionTest(
      hits(control),
      control.users,
      hits(v),
      v.users,
    );
    if (!test || v.users < MIN_USERS || control.users < MIN_USERS)
      return {
        ...base,
        uplift: test?.uplift ?? null,
        pValue: test?.pValue ?? null,
        significance: "insufficient",
      };
    const significance =
      test.pValue < ALPHA
        ? test.z > 0
          ? "winner"
          : "loser"
        : "not-significant";
    return { ...base, uplift: test.uplift, pValue: test.pValue, significance };
  });
  const label = metric === "purchase" ? "purchase rate" : "paywall-view rate";
  const winner = variants
    .filter((v) => v.significance === "winner")
    .sort((a, b) => (b.uplift ?? 0) - (a.uplift ?? 0))[0];
  const verdict = !metric
    ? "Map paywall and purchase events to compare variants"
    : winner
      ? `“${winner.variant}” is a likely winner on ${label}${winner.uplift != null ? ` (${winner.uplift > 0 ? "+" : ""}${Math.round(winner.uplift * 100)}%)` : ""}`
      : variants.some((v) => v.significance === "loser")
        ? `Control is ahead on ${label}`
        : variants.some((v) => v.significance === "not-significant")
          ? `No significant difference in ${label} yet`
          : "Too few users to call it yet";
  return { flag: exp.flag, users: exp.users, metric, app, variants, verdict };
}

export function getPosthogExperimentResults(
  workspaceId: string,
  appId: number | null,
  limit: number | null,
): Promise<ExperimentsResult> {
  return cached(
    key(workspaceId, `experiments:${limit ?? "all"}`, appId),
    TTL,
    async () => {
      const r = await resolve(workspaceId, appId);
      const { results, errors } = await settle(r.targets, (t) =>
        getPosthogExperiments(workspaceId, { ...t.query, days: 30 }),
      );
      const experiments = results
        .flatMap((x) =>
          x.value.experiments
            .filter((e) => e.variants.length > 1)
            .map((e) => judge(e, x.target.ref)),
        )
        .sort((a, b) => b.users - a.users);
      return {
        ...scopeOf(r, errors),
        days: 30,
        experiments: limit ? experiments.slice(0, limit) : experiments,
      };
    },
  );
}
