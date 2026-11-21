import { getGeography, getOverview } from "@/lib/analytics/queries";
import { getStoreAnalytics } from "@/lib/asc/analytics/service";
import type { StoreAnalyticsResult, StoreStatus } from "@/lib/asc/analytics/types";
import { getApp, listVersions } from "@/lib/aso/apps";
import { listMappings } from "@/lib/posthog/apps";
import { isPosthogConfigured } from "@/lib/posthog/client";
import { getPosthogGeography, getPosthogNewUsers } from "@/lib/posthog/queries";
import { cached, wsKey } from "@/lib/server/cache";
import { db } from "@/lib/server/db";
import { getTrends } from "@/lib/trends/service";
import type { TrendsResult } from "@/lib/trends/types";
import { TRAFFIC_DAYS, type TrafficCountry, type TrafficDays, type TrafficPoint, type TrafficReconcile, type TrafficResult, type TrafficSource, type TrafficSourceState, type TrafficStep } from "./types";

export type * from "./types";

const TTL = 2 * 60 * 1000;
const DAY = 86400000;
const DEMO_SLUG = "tappy";

const APPLE_STATE: Record<StoreStatus, TrafficSourceState> = {
  ok: "ok",
  not_connected: "connect",
  not_linked: "setup",
  not_requested: "waiting",
  waiting: "waiting",
  error: "error",
};

export function trafficDays(value: unknown): TrafficDays {
  const n = Number(value);
  return TRAFFIC_DAYS.find((d) => d === n) ?? 30;
}

function isoDay(t: number) {
  return new Date(t).toISOString().slice(0, 10);
}

function range(from: string, to: string) {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += DAY) out.push(isoDay(t));
  return out;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

const off = (state: TrafficSourceState, text: string | null = null): TrafficSource => ({ state, demo: false, message: text, through: null });

type Loaded<T> = { source: TrafficSource; data: T | null };

async function loadApple(workspaceId: string, appId: number, days: TrafficDays, country: string, demo: boolean): Promise<Loaded<StoreAnalyticsResult>> {
  try {
    const data = await getStoreAnalytics(workspaceId, appId, { days, country, demo: demo ? "only" : "never" });
    const state = APPLE_STATE[data.status];
    return { source: { state, demo: data.demo, message: state === "ok" ? null : data.message, through: data.dataThrough }, data: state === "ok" ? data : null };
  } catch (error) {
    return { source: off("error", message(error)), data: null };
  }
}

type PosthogData = {
  total: number;
  previous: number;
  series: Map<string, number>;
  countries: Map<string, number>;
};

async function loadPosthog(workspaceId: string, appId: number, days: TrafficDays, country: string, demo: boolean): Promise<Loaded<PosthogData>> {
  try {
    if (!demo) {
      if (!(await isPosthogConfigured(workspaceId))) return { source: off("connect"), data: null };
      if (!(await listMappings(workspaceId)).some((m) => m.appId === appId)) return { source: off("setup"), data: null };
    }
    const query = demo ? { days, demo: DEMO_SLUG } : { days, appId };
    const [users, geo] = await Promise.all([getPosthogNewUsers(workspaceId, query, country === "all" ? null : country), getPosthogGeography(workspaceId, query).catch(() => null)]);
    return {
      source: { state: "ok", demo: users.demo, message: users.roles.install.length ? null : "No first-open event is mapped for this app", through: users.to },
      data: {
        total: users.total,
        previous: users.previousTotal,
        series: new Map(users.series.map((p) => [p.date, p.newUsers])),
        countries: new Map((geo?.countries ?? []).filter((c) => c.country !== "??").map((c) => [c.country, c.newUsers])),
      },
    };
  } catch (error) {
    return { source: off("error", message(error)), data: null };
  }
}

type RevenueData = {
  trials: number;
  purchases: number;
  revenue: number;
  previous: { trials: number; purchases: number; revenue: number } | null;
  countries: Map<string, number>;
  payersOnly: boolean;
};

async function revenueProviders(workspaceId: string, appId: number) {
  const row = await db.get<{ providers: string | null }>(
    `SELECT string_agg(DISTINCT provider, ',') AS providers FROM revenue_events WHERE workspace_id = ? AND type NOT IN ('test','other') AND (app_id = ? OR app_id IS NULL)`,
    [workspaceId, appId],
  );
  return row?.providers ? row.providers.split(",") : [];
}

async function hasAttribution(workspaceId: string, appId: number) {
  const row = await db.get<{ found: boolean }>("SELECT EXISTS(SELECT 1 FROM installs WHERE workspace_id = ? AND app_id = ?) AS found", [workspaceId, appId]);
  return !!row?.found;
}

async function loadRevenue(workspaceId: string, appId: number, days: TrafficDays, country: string, demo: boolean): Promise<Loaded<RevenueData> & { providers: string[] }> {
  try {
    const providers = demo ? ["revenuecat"] : await revenueProviders(workspaceId, appId);
    if (!providers.length) return { source: off("connect"), data: null, providers };
    const query = { days, appId, demo: demo ? ("only" as const) : ("never" as const) };
    const [overview, geo] = await Promise.all([getOverview(workspaceId, query), getGeography(workspaceId, query)]);
    const countries = new Map(geo.countries.filter((c) => c.country !== "??").map((c) => [c.country.toLowerCase(), c.revenue]));
    const source: TrafficSource = { state: "ok", demo: overview.demo, message: null, through: overview.to };
    if (country !== "all") {
      const row = geo.countries.find((c) => c.country.toLowerCase() === country);
      return { source, providers, data: { trials: row?.trials ?? 0, purchases: row?.payers ?? 0, revenue: row?.revenue ?? 0, previous: null, countries, payersOnly: true } };
    }
    const t = overview.totals;
    const p = overview.previous;
    return {
      source,
      providers,
      data: { trials: t.trials, purchases: t.purchases, revenue: t.netRevenue, previous: { trials: p.trials, purchases: p.purchases, revenue: p.netRevenue }, countries, payersOnly: false },
    };
  } catch (error) {
    return { source: off("error", message(error)), data: null, providers: [] };
  }
}

function overlap(daily: TrafficPoint[], a: keyof TrafficPoint, b: keyof TrafficPoint) {
  const rows = daily.filter((p) => p[a] != null && p[b] != null);
  if (rows.length < 2) return null;
  const sum = (k: keyof TrafficPoint) => rows.reduce((s, p) => s + Number(p[k]), 0);
  return { days: rows.length, from: rows[0].date, to: rows[rows.length - 1].date, a: sum(a), b: sum(b) };
}

function countryRows(apple: StoreAnalyticsResult | null, posthog: PosthogData | null, revenue: RevenueData | null, trends: TrendsResult | null): TrafficCountry[] {
  const rows = new Map<string, TrafficCountry>();
  const row = (country: string) => {
    const existing = rows.get(country);
    if (existing) return existing;
    const created: TrafficCountry = { country, downloads: apple ? 0 : null, firstOpens: posthog ? 0 : null, revenue: revenue ? 0 : null, estSearch: null, keywords: 0, top10: 0, best: null };
    rows.set(country, created);
    return created;
  };
  for (const t of apple?.territories ?? []) row(t.territory.toLowerCase()).downloads = t.firstDownloads;
  for (const [country, users] of posthog?.countries ?? []) row(country).firstOpens = users;
  for (const [country, amount] of revenue?.countries ?? []) row(country).revenue = Math.round(amount * 100) / 100;
  for (const c of trends?.countries ?? []) {
    const r = row(c.country);
    r.estSearch = c.installs;
    r.keywords = c.keywords;
    r.top10 = c.top10;
    r.best = c.bestKeyword && { id: c.bestKeyword.id, term: c.bestKeyword.term, position: c.bestKeyword.position };
  }
  return [...rows.values()]
    .filter((r) => r.downloads || r.firstOpens || r.revenue || r.keywords)
    .sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0) || (b.firstOpens ?? 0) - (a.firstOpens ?? 0) || (b.estSearch ?? 0) - (a.estSearch ?? 0));
}

export type TrafficQuery = { days?: number; country?: string | null; demo?: boolean };

export async function getTraffic(workspaceId: string, appId: number, q: TrafficQuery = {}): Promise<TrafficResult> {
  const app = await getApp(workspaceId, appId);
  const days = trafficDays(q.days);
  const country = q.country && q.country !== "all" ? q.country.toLowerCase() : "all";
  const demo = !!q.demo;
  return cached(wsKey(workspaceId, `traffic:${appId}:${days}:${country}:${demo ? 1 : 0}`), TTL, async () => {
    const trendsFor = (c: string) => (app.keywordCount ? getTrends(workspaceId, appId, { country: c, days }).catch(() => null) : Promise.resolve(null));
    const [apple, posthog, revenue, trends, allTrends, versions, attribution] = await Promise.all([
      loadApple(workspaceId, appId, days, country, demo),
      loadPosthog(workspaceId, appId, days, country, demo),
      loadRevenue(workspaceId, appId, days, country, demo),
      trendsFor(country),
      country === "all" ? Promise.resolve(null) : trendsFor("all"),
      listVersions(app.trackId).catch(() => []),
      demo ? Promise.resolve(true) : hasAttribution(workspaceId, appId).catch(() => false),
    ]);

    const to = isoDay(Date.now());
    const calendarFrom = isoDay(Date.now() - (days - 1) * DAY);
    const from = apple.data?.from && apple.data.from < calendarFrom ? apple.data.from : calendarFrom;
    const appleByDate = new Map((apple.data?.daily ?? []).map((p) => [p.date, p]));
    const searchByDate = new Map((apple.data?.sourceDaily ?? []).map((r) => [String(r.date), Number(r["search:firstDownloads"]) || 0]));
    const estByDate = new Map((trends?.points ?? []).filter((p) => p.tracked > 0).map((p) => [p.date, p.installs]));
    const daily: TrafficPoint[] = range(from, to).map((date) => {
      const a = appleByDate.get(date);
      return {
        date,
        downloads: a ? a.firstDownloads : null,
        searchDownloads: a ? (searchByDate.get(date) ?? 0) : null,
        impressions: a ? a.impressions : null,
        firstOpens: posthog.data && date >= calendarFrom ? (posthog.data.series.get(date) ?? 0) : null,
        estSearch: estByDate.get(date) ?? null,
      };
    });

    const totals = apple.data?.totals ?? null;
    const steps: TrafficStep[] = [
      { key: "impressions", source: "apple", value: totals?.impressions.current ?? null, previous: totals?.impressions.previous ?? null },
      { key: "pageViews", source: "apple", value: totals?.pageViews.current ?? null, previous: totals?.pageViews.previous ?? null },
      { key: "downloads", source: "apple", value: totals?.firstDownloads.current ?? null, previous: totals?.firstDownloads.previous ?? null },
      { key: "firstOpens", source: "posthog", value: posthog.data?.total ?? null, previous: posthog.data?.previous ?? null },
      { key: "trials", source: "revenue", value: revenue.data?.trials ?? null, previous: revenue.data?.previous?.trials ?? null },
      { key: "purchases", source: "revenue", value: revenue.data?.purchases ?? null, previous: revenue.data?.previous?.purchases ?? null },
      { key: "revenue", source: "revenue", value: revenue.data ? Math.round(revenue.data.revenue * 100) / 100 : null, previous: revenue.data?.previous ? Math.round(revenue.data.previous.revenue * 100) / 100 : null },
    ];

    const reconcile: TrafficReconcile[] = [];
    const opens = overlap(daily, "firstOpens", "downloads");
    if (opens) reconcile.push({ kind: "opens", days: opens.days, from: opens.from, to: opens.to, opens: opens.a, downloads: opens.b });
    const search = overlap(daily, "estSearch", "searchDownloads");
    if (search) reconcile.push({ kind: "search", days: search.days, from: search.from, to: search.to, estimated: Math.round(search.a * 10) / 10, apple: search.b });

    const end = trends?.kpis.end ?? null;
    const tracked = (trends?.points ?? []).filter((p) => p.tracked > 0).slice(-7);
    return {
      appId,
      days,
      country,
      demo,
      from,
      to,
      sources: { apple: apple.source, posthog: posthog.source, revenue: revenue.source },
      revenueProviders: revenue.providers,
      payersOnly: !!revenue.data?.payersOnly,
      attribution,
      rankings: {
        keywords: trends?.keywords.length ?? 0,
        targets: end?.targets ?? 0,
        estPerDay: tracked.length ? Math.round((tracked.reduce((s, p) => s + p.installs, 0) / tracked.length) * 10) / 10 : null,
        reach: end?.reach ?? null,
        top10: end?.top10 ?? 0,
      },
      steps,
      daily,
      versions: versions.map((v) => ({ version: v.version, date: v.releasedAt.slice(0, 10) })).filter((v) => v.date >= from && v.date <= to),
      reconcile,
      countries: countryRows(apple.data, posthog.data, revenue.data, allTrends ?? trends),
      territories: (apple.data?.availableTerritories ?? []).map((t) => t.toLowerCase()),
    };
  });
}
