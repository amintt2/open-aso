import { getOverview } from "@/lib/analytics/queries";
import { isAscConfigured } from "@/lib/asc/client";
import { getConnection, getDashboard } from "@/lib/apple-ads/service";
import { egressStats } from "@/lib/appstore/egress";
import { providerActivity } from "@/lib/integrations/log";
import { lastDetection, lastMultiDetection } from "@/lib/keywords/autodetect";
import { mcpEnabled } from "@/lib/mcp/config";
import { isPosthogConfigured } from "@/lib/posthog/client";
import { listMappings } from "@/lib/posthog/apps";
import { getPosthogNewUsers } from "@/lib/posthog/queries";
import { languageMatches } from "@/lib/relevance/language";
import { cached, wsKey } from "@/lib/server/cache";
import { db } from "@/lib/server/db";
import { workspaceQueueStats } from "@/lib/worker/queue";
import {
  appRef,
  averagePeriod,
  bestKeyword,
  combinedPoints,
  moversAcross,
  periodOf,
  workspaceTrends,
  type AppTrends,
} from "./trends";
import type {
  AppsResult,
  AppWarnings,
  DashboardAlert,
  HomeKpis,
  MoversResult,
  Period,
  RevenueChart,
} from "./types";

const TTL = 5 * 60 * 1000;
const STALE_HOURS = 48;

type KeywordFacts = {
  app_id: number;
  term: string;
  country: string;
  relevance_category: string | null;
  last_refreshed_at: string | null;
};

const key = (workspaceId: string, name: string) =>
  wsKey(workspaceId, `dashboard:${name}`);

async function sdkAndRevenue(workspaceId: string) {
  const row = await db.get<{
    installs: boolean;
    revenue: boolean;
    providers: string | null;
  }>(
    `SELECT EXISTS(SELECT 1 FROM installs WHERE workspace_id = ?) AS installs,
            EXISTS(SELECT 1 FROM revenue_events WHERE workspace_id = ? AND type NOT IN ('test','other')) AS revenue,
            (SELECT string_agg(DISTINCT provider, ',') FROM revenue_events WHERE workspace_id = ?) AS providers`,
    [workspaceId, workspaceId, workspaceId],
  );
  return {
    installs: !!row?.installs,
    revenue: !!row?.revenue,
    providers: row?.providers ? row.providers.split(",") : [],
  };
}

async function posthogReady(workspaceId: string) {
  if (!(await isPosthogConfigured(workspaceId))) return false;
  return (await listMappings(workspaceId)).length > 0;
}

async function installsPeriod(
  workspaceId: string,
  days: number,
  appId: number | null,
  has: { installs: boolean },
): Promise<(Period & { source: "posthog" | "sdk" }) | null> {
  if (await posthogReady(workspaceId)) {
    const mapped =
      appId == null ||
      (await listMappings(workspaceId)).some((m) => m.appId === appId);
    if (mapped) {
      const res = await getPosthogNewUsers(workspaceId, { days, appId }).catch(
        () => null,
      );
      if (res)
        return {
          current: res.total,
          previous: res.previousTotal,
          source: "posthog",
        };
    }
  }
  if (!has.installs) return null;
  const o = await getOverview(workspaceId, { days, appId, demo: "never" });
  return {
    current: o.totals.installs,
    previous: o.previous.installs,
    source: "sdk",
  };
}

export async function revenuePeriod(
  workspaceId: string,
  days: number,
  appId: number | null,
  has: { revenue: boolean },
): Promise<Period | null> {
  if (!has.revenue) return null;
  const o = await getOverview(workspaceId, { days, appId, demo: "never" });
  return { current: o.totals.netRevenue, previous: o.previous.netRevenue };
}

export async function observedPeriods(
  workspaceId: string,
  days: number,
  appId: number | null,
) {
  const has = await sdkAndRevenue(workspaceId);
  const [installs, revenue] = await Promise.all([
    installsPeriod(workspaceId, days, appId, has).catch(() => null),
    revenuePeriod(workspaceId, days, appId, has).catch(() => null),
  ]);
  return { installs, revenue, providers: has.providers };
}

async function adsKpi(
  workspaceId: string,
): Promise<{ ads: HomeKpis["ads"]; error: string | null }> {
  const connection = await getConnection(workspaceId);
  if (!connection.connected)
    return {
      ads: null,
      error: connection.configured ? connection.lastError : null,
    };
  try {
    const d = await getDashboard(workspaceId, { days: 7 });
    return {
      ads: {
        currency: d.currency,
        spend: {
          current: d.totals.spend,
          previous: d.previousTotals?.spend ?? null,
        },
        installs: d.totals.installs,
        roas: d.attribution?.roas ?? null,
        cpa: d.totals.cpa,
      },
      error: connection.lastError,
    };
  } catch (error) {
    return {
      ads: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function getHomeKpis(workspaceId: string): Promise<HomeKpis> {
  return cached(key(workspaceId, "kpis"), TTL, async () => {
    const [counts, list, observed, ads] = await Promise.all([
      db.get<{ apps: number; total: number; added: number }>(
        `SELECT (SELECT count(*) FROM apps WHERE workspace_id = ?) AS apps, count(k.id) AS total,
                count(k.id) FILTER (WHERE k.created_at >= now() - interval '7 days') AS added
         FROM keywords k JOIN apps a ON a.id = k.app_id WHERE a.workspace_id = ?`,
        [workspaceId, workspaceId],
      ),
      workspaceTrends(workspaceId),
      observedPeriods(workspaceId, 7, null),
      adsKpi(workspaceId).catch((error) => ({
        ads: null,
        error: error instanceof Error ? error.message : String(error),
      })),
    ]);
    const points = combinedPoints(list);
    return {
      apps: counts?.apps ?? 0,
      trackedKeywords: counts?.total ?? 0,
      addedThisWeek: counts?.added ?? 0,
      top10: periodOf(points, (p) => (p.tracked ? p.top3 + p.top10 : null)),
      visibility: periodOf(points, (p) => (p.tracked ? p.visibility : null)),
      searchInstalls: averagePeriod(points, (p) => p.installs),
      installs: observed.installs,
      revenue: observed.revenue
        ? { ...observed.revenue, providers: observed.providers }
        : null,
      ads: ads.ads,
      adsError: ads.error,
    };
  });
}

async function keywordFacts(workspaceId: string) {
  return db.all<KeywordFacts>(
    `SELECT k.app_id, k.term, k.country, k.relevance_category, k.last_refreshed_at FROM keywords k JOIN apps a ON a.id = k.app_id WHERE a.workspace_id = ?`,
    [workspaceId],
  );
}

function warningsFor(facts: KeywordFacts[]) {
  const cutoff = Date.now() - STALE_HOURS * 3600_000;
  let lastRefreshedAt: string | null = null;
  const w = { unrelated: 0, wrongLanguage: 0, stale: 0 };
  for (const f of facts) {
    if (f.relevance_category === "unrelated") w.unrelated++;
    if (!languageMatches(f.term, f.country)) w.wrongLanguage++;
    if (!f.last_refreshed_at || Date.parse(f.last_refreshed_at) < cutoff)
      w.stale++;
    if (
      f.last_refreshed_at &&
      (!lastRefreshedAt || f.last_refreshed_at > lastRefreshedAt)
    )
      lastRefreshedAt = f.last_refreshed_at;
  }
  return { ...w, lastRefreshedAt };
}

async function detectionRan(
  workspaceId: string,
  appId: number,
  country: string,
) {
  const [single, multi] = await Promise.all([
    lastDetection(workspaceId, appId, country),
    lastMultiDetection(workspaceId, appId),
  ]);
  return !!(single || multi);
}

async function appsFrom(
  workspaceId: string,
  list: AppTrends[],
): Promise<AppsResult> {
  const [facts, ascConfigured] = await Promise.all([
    keywordFacts(workspaceId),
    isAscConfigured(workspaceId).catch(() => false),
  ]);
  const byApp = new Map<number, KeywordFacts[]>();
  for (const f of facts)
    byApp.set(f.app_id, [...(byApp.get(f.app_id) ?? []), f]);
  const dates = list.find((x) => x.trends)?.trends?.dates ?? [];
  const apps = await Promise.all(
    list.map(async ({ app, trends }) => {
      const w = warningsFor(byApp.get(app.id) ?? []);
      const end = trends ? trends.points.length - 1 : -1;
      const last = trends?.kpis.end ?? null;
      const start = trends?.kpis.start ?? null;
      const warnings: AppWarnings = {
        unrelated: w.unrelated,
        wrongLanguage: w.wrongLanguage,
        stale: w.stale,
        ascNotLinked: ascConfigured && app.isMine && !app.ascAppId,
        detectionNeverRun:
          app.isMine &&
          !(await detectionRan(workspaceId, app.id, app.primaryCountry)),
      };
      return {
        id: app.id,
        name: app.name,
        subtitle: app.subtitle,
        iconUrl: app.iconUrl,
        primaryCountry: app.primaryCountry,
        keywordCount: app.keywordCount,
        countries: app.countries,
        series: trends
          ? trends.points.map((p) => ({
              date: p.date,
              visibility: p.tracked ? p.visibility : null,
            }))
          : [],
        visibility: last?.visibility ?? null,
        visibilityChange:
          last?.visibility != null &&
          start?.visibility != null &&
          start.date !== last.date
            ? Math.round((last.visibility - start.visibility) * 10) / 10
            : null,
        avgPosition: last?.avgPosition ?? null,
        top10: last?.top10 ?? 0,
        top3: last?.top3 ?? 0,
        tracked: last?.tracked ?? 0,
        bestKeyword:
          trends && end >= 0 ? bestKeyword(trends.keywords, end) : null,
        warnings,
        lastRefreshedAt: w.lastRefreshedAt,
      };
    }),
  );
  return { dates, apps };
}

export function getHomeApps(workspaceId: string): Promise<AppsResult> {
  return cached(key(workspaceId, "apps"), TTL, async () =>
    appsFrom(workspaceId, await workspaceTrends(workspaceId)),
  );
}

export function getHomeMovers(workspaceId: string): Promise<MoversResult> {
  return cached(key(workspaceId, "movers"), TTL, async () => ({
    days: 7,
    ...moversAcross(await workspaceTrends(workspaceId)),
  }));
}

export function getRevenueChart(
  workspaceId: string,
  days = 30,
): Promise<RevenueChart> {
  return cached(key(workspaceId, `revenue:${days}`), TTL, async () => {
    const has = await sdkAndRevenue(workspaceId);
    const posthog = await posthogReady(workspaceId);
    if (!posthog && !has.installs && !has.revenue) {
      const demo = await getOverview(workspaceId, { days, demo: "only" });
      return {
        demo: true,
        installsSource: "demo",
        revenueAvailable: true,
        points: demo.series.map((p) => ({
          date: p.date,
          installs: p.installs,
          revenue: p.netRevenue,
        })),
      };
    }
    const [overview, newUsers] = await Promise.all([
      getOverview(workspaceId, { days, demo: "never" }),
      posthog
        ? getPosthogNewUsers(workspaceId, { days }).catch(() => null)
        : Promise.resolve(null),
    ]);
    const fromPosthog = new Map(
      newUsers?.series.map((p) => [p.date, p.newUsers]) ?? [],
    );
    const installsSource = newUsers ? "posthog" : has.installs ? "sdk" : null;
    return {
      demo: false,
      installsSource,
      revenueAvailable: has.revenue,
      points: overview.series.map((p) => ({
        date: p.date,
        installs:
          installsSource === "posthog"
            ? (fromPosthog.get(p.date) ?? 0)
            : p.installs,
        revenue: p.netRevenue,
      })),
    };
  });
}

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

export function getHomeAlerts(workspaceId: string): Promise<DashboardAlert[]> {
  return cached(key(workspaceId, "alerts"), TTL, async () => {
    const list = await workspaceTrends(workspaceId);
    const [apps, queue, rc, sw, sdk, ads, mcp] = await Promise.all([
      appsFrom(workspaceId, list),
      workspaceQueueStats(workspaceId).catch(() => null),
      providerActivity(workspaceId, "revenuecat"),
      providerActivity(workspaceId, "superwall"),
      providerActivity(workspaceId, "sdk"),
      getConnection(workspaceId).catch(() => null),
      mcpEnabled(workspaceId).catch(() => true),
    ]);
    const alerts: DashboardAlert[] = [];
    const movers = moversAcross(list, 7, 50);
    for (const m of movers.losers) {
      const href = `/apps/${m.appId}/keywords`;
      const app = { appId: m.appId, appName: m.appName, iconUrl: m.iconUrl };
      const from = m.startPosition == null ? "200+" : `#${m.startPosition}`;
      const to = m.endPosition == null ? "200+" : `#${m.endPosition}`;
      if (
        m.startPosition != null &&
        m.startPosition <= 50 &&
        (m.endPosition == null || m.endPosition > 50)
      )
        alerts.push({
          id: `out-${m.id}`,
          severity: "high",
          title: `“${m.term}” fell out of the top 50`,
          detail: `${from} → ${to} in ${m.country.toUpperCase()} over 7 days`,
          href,
          app,
        });
      else if (
        m.positionChange <= -10 &&
        m.startPosition != null &&
        m.startPosition <= 100
      )
        alerts.push({
          id: `drop-${m.id}`,
          severity: "medium",
          title: `“${m.term}” dropped ${Math.abs(m.positionChange)} places`,
          detail: `${from} → ${to} in ${m.country.toUpperCase()} over 7 days`,
          href,
          app,
        });
    }
    for (const a of apps.apps) {
      const app = appRef({ id: a.id, name: a.name, iconUrl: a.iconUrl });
      if (a.warnings.stale > 0)
        alerts.push({
          id: `stale-${a.id}`,
          severity: "medium",
          title: `${a.warnings.stale} keyword${a.warnings.stale === 1 ? "" : "s"} not refreshed in ${STALE_HOURS}h`,
          detail: a.lastRefreshedAt
            ? `Last refresh ${a.lastRefreshedAt.slice(0, 10)}`
            : "Never refreshed",
          href: `/apps/${a.id}/keywords`,
          app,
        });
      if (a.warnings.detectionNeverRun)
        alerts.push({
          id: `detect-${a.id}`,
          severity: "low",
          title: "Keyword detection hasn't run",
          detail:
            "Detect the keywords this app already ranks for in one click.",
          href: `/apps/${a.id}/keywords`,
          app,
        });
      if (a.warnings.unrelated + a.warnings.wrongLanguage > 0)
        alerts.push({
          id: `relevance-${a.id}`,
          severity: "low",
          title: `${a.warnings.unrelated + a.warnings.wrongLanguage} off-target keyword${a.warnings.unrelated + a.warnings.wrongLanguage === 1 ? "" : "s"}`,
          detail: `${a.warnings.unrelated} unrelated · ${a.warnings.wrongLanguage} in the wrong language`,
          href: `/apps/${a.id}/keywords`,
          app,
        });
      if (a.warnings.ascNotLinked)
        alerts.push({
          id: `asc-${a.id}`,
          severity: "low",
          title: "Not linked to App Store Connect",
          detail: "Link it to read your keyword field and real metadata.",
          href: `/apps/${a.id}/page`,
          app,
        });
    }
    if (queue && queue.failedToday > 0)
      alerts.push({
        id: "fetch-failed",
        severity: "medium",
        title: `${queue.failedToday} App Store request${queue.failedToday === 1 ? "" : "s"} failed today`,
        detail:
          queue.lastError?.message ??
          "Refreshes will be retried automatically.",
        href: "/settings",
      });
    const throttled = egressStats().egresses.filter((e) => e.cooldownMs > 0);
    if (throttled.length)
      alerts.push({
        id: "throttled",
        severity: "medium",
        title: "App Store is throttling requests",
        detail: `Paused for ~${Math.ceil(Math.max(...throttled.map((e) => e.cooldownMs)) / 1000)}s. Refreshes resume automatically.`,
        href: "/settings",
      });
    const recent = (iso: string | undefined) =>
      !!iso && Date.now() - Date.parse(iso) < 7 * 86400_000;
    for (const [id, name, activity] of [
      ["revenuecat", "RevenueCat", rc],
      ["superwall", "Superwall", sw],
      ["sdk", "Open ASO SDK", sdk],
    ] as const)
      if (
        activity.lastError &&
        recent(activity.lastError.receivedAt) &&
        (!activity.lastEvent ||
          activity.lastError.receivedAt > activity.lastEvent.receivedAt)
      )
        alerts.push({
          id: `int-${id}`,
          severity: "high",
          title: `${name} webhook error`,
          detail: activity.lastError.message ?? "The last event was rejected.",
          href: "/integrations",
        });
    if (ads?.configured && ads.lastError)
      alerts.push({
        id: "ads-error",
        severity: "high",
        title: "Apple Ads connection error",
        detail: ads.lastError,
        href: "/apple-ads",
      });
    if (!mcp)
      alerts.push({
        id: "mcp-off",
        severity: "low",
        title: "MCP server is disabled",
        detail:
          "Enable it to let Claude or Codex read and act on your ASO data.",
        href: "/mcp",
      });
    return alerts.sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
    );
  });
}
