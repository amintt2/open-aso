import { getApp } from "@/lib/aso/apps";
import { listKeywords } from "@/lib/aso/keywords";
import { normalizeTerm } from "@/lib/aso/scoring";
import { campaignAppMap } from "@/lib/apple-ads/service";
import { getMapping } from "@/lib/posthog/apps";
import { isPosthogConfigured } from "@/lib/posthog/client";
import { newUsersByDay } from "@/lib/posthog/queries";
import { cached, cacheDelete, wsKey } from "@/lib/server/cache";
import { db } from "@/lib/server/db";
import { HttpError } from "@/lib/server/http";
import { getSetting, setSetting } from "@/lib/server/settings";
import { demoInputs, demoKeywords, IMPACT_DEMO_NOTICE, type SourceKeyword } from "./demo";
import { dailyTrack, normalizeSearchShare, runModel, type ModelCountryInput, type ModelKeywordInput, type ModelOutput, type Snapshot } from "./model";
import type { ImpactDataSources, ImpactDays, ImpactDemoMode, ImpactResult } from "./types";
import { chartOf, geographyOf, publicCountry, scopeOf, totalsOf } from "./view";

export type * from "./types";

export type ImpactQuery = { country?: string | null; days?: number; demo?: ImpactDemoMode };

type Computed = {
  demo: boolean;
  calibrated: boolean;
  dates: string[];
  searchShare: number;
  revenueAvailable: boolean;
  model: ModelOutput;
  otherCountries: { observed: number; paid: number } | null;
  dataSources: ImpactDataSources;
};

type KeywordInput = SourceKeyword & { snapshots: Snapshot[]; paidInstalls: number; attributedRevenue: number | null };

const DAY_MS = 86400000;
const TTL = 10 * 60 * 1000;
const VALID_REVENUE = "r.type NOT IN ('test','other') AND COALESCE(r.raw ->> 'environment', '') != 'SANDBOX'";

export function impactDays(value: unknown): ImpactDays {
  const n = Number(value);
  return n === 7 || n === 90 ? n : 30;
}

function isoDay(t: number) {
  return new Date(t).toISOString().slice(0, 10);
}

function windowDates(days: number) {
  const now = Date.now();
  return Array.from({ length: days }, (_, i) => isoDay(now - (days - 1 - i) * DAY_MS));
}

export async function getSearchShare(workspaceId: string) {
  return normalizeSearchShare(await getSetting(workspaceId, "impact.searchShare"));
}

export async function setSearchShare(workspaceId: string, value: number | null) {
  if (value != null && !(value > 0 && value <= 1)) throw new HttpError(400, "searchShare must be between 0 and 1");
  await setSetting(workspaceId, "impact.searchShare", value == null ? null : String(value));
  await clearImpactCache(workspaceId);
  return getSearchShare(workspaceId);
}

function emptySeries(n: number) {
  return Array.from({ length: n }, () => 0);
}

function addTo(map: Map<string, number[]>, country: string, index: number, value: number, n: number) {
  const series = map.get(country) ?? emptySeries(n);
  series[index] += value;
  map.set(country, series);
}

async function snapshotsFor(workspaceId: string, appId: number, from: string) {
  const rows = await db.all<{ keyword_id: number; date: string; position: number | null; popularity: number | null }>(
    `SELECT s.keyword_id, s.date, s.position, s.popularity FROM keyword_snapshots s
     JOIN keywords k ON k.id = s.keyword_id JOIN apps a ON a.id = k.app_id
     WHERE a.workspace_id = ? AND k.app_id = ? AND s.date >= (?::date - 180) ORDER BY s.date ASC`,
    [workspaceId, appId, from],
  );
  const map = new Map<number, Snapshot[]>();
  for (const r of rows) map.set(r.keyword_id, [...(map.get(r.keyword_id) ?? []), { date: r.date, position: r.position, popularity: r.popularity }]);
  return map;
}

async function detect(workspaceId: string, appId: number) {
  const [posthogReady, sdk, revenue, campaigns] = await Promise.all([
    (async () => (await isPosthogConfigured(workspaceId)) && !!(await getMapping(workspaceId, appId)))().catch(() => false),
    db.get<{ ok: boolean }>("SELECT EXISTS(SELECT 1 FROM installs WHERE workspace_id = ? AND app_id = ?) AS ok", [workspaceId, appId]),
    db.get<{ ok: boolean }>(`SELECT EXISTS(SELECT 1 FROM revenue_events r WHERE r.workspace_id = ? AND r.app_id = ? AND ${VALID_REVENUE}) AS ok`, [workspaceId, appId]),
    campaignAppMap(workspaceId).then((links) => links.filter((l) => l.appId === appId)),
  ]);
  return { posthog: posthogReady, sdk: !!sdk?.ok, revenue: !!revenue?.ok, campaigns };
}

async function posthogObserved(workspaceId: string, appId: number, days: number, dates: string[], countries: string[]) {
  const index = new Map(dates.map((d, i) => [d, i]));
  const toSeries = (points: { date: string; newUsers: number }[]) => {
    const series = emptySeries(dates.length);
    for (const p of points) {
      const i = index.get(p.date);
      if (i != null) series[i] += p.newUsers;
    }
    return series;
  };
  const [total, ...perCountry] = await Promise.all([
    newUsersByDay(workspaceId, appId, days, null),
    ...countries.map((c) => newUsersByDay(workspaceId, appId, days, c)),
  ]);
  return {
    byCountry: new Map(countries.map((c, i) => [c, toSeries(perCountry[i])])),
    total: toSeries(total).reduce((a, b) => a + b, 0),
  };
}

async function sdkInstalls(workspaceId: string, appId: number, dates: string[]) {
  const index = new Map(dates.map((d, i) => [d, i]));
  const rows = await db.all<{ country: string; day: string; source: string; n: number }>(
    `SELECT lower(COALESCE(i.country, '??')) AS country, analytics_day(i.installed_at) AS day, i.source, COUNT(*)::int AS n
     FROM installs i WHERE i.workspace_id = ? AND i.app_id = ? AND analytics_day(i.installed_at) BETWEEN ?::date AND ?::date GROUP BY 1, 2, 3`,
    [workspaceId, appId, dates[0], dates[dates.length - 1]],
  );
  const observed = new Map<string, number[]>();
  const paid = new Map<string, number[]>();
  let total = 0;
  for (const r of rows) {
    const i = index.get(r.day);
    if (i == null) continue;
    total += r.n;
    addTo(observed, r.country, i, r.n, dates.length);
    if (r.source === "apple_ads") addTo(paid, r.country, i, r.n, dates.length);
  }
  return { observed, paid, total };
}

async function adsInstalls(workspaceId: string, campaigns: { campaignId: string; countries: string[] }[], fallbackCountry: string, dates: string[]) {
  const index = new Map(dates.map((d, i) => [d, i]));
  const daily = new Map<string, number[]>();
  const byKeyword = new Map<string, number>();
  if (!campaigns.length) return { daily, byKeyword };
  const rows = await db.all<{ campaign_id: string; country: string | null; keyword: string; date: string; installs: number }>(
    `SELECT a.campaign_id, lower(a.country) AS country, a.keyword, a.date, SUM(a.installs)::int AS installs FROM ads_keyword_daily a
     WHERE a.workspace_id = ? AND a.campaign_id = ANY(?::text[]) AND a.date BETWEEN ?::date AND ?::date GROUP BY 1, 2, 3, 4`,
    [workspaceId, campaigns.map((c) => c.campaignId), dates[0], dates[dates.length - 1]],
  );
  const campaignCountry = new Map(campaigns.map((c) => [c.campaignId, c.countries[0]?.toLowerCase() ?? null]));
  for (const r of rows) {
    const i = index.get(r.date);
    if (i == null || !r.installs) continue;
    const country = r.country ?? campaignCountry.get(r.campaign_id) ?? fallbackCountry;
    addTo(daily, country, i, r.installs, dates.length);
    const key = `${country}|${normalizeTerm(r.keyword)}`;
    byKeyword.set(key, (byKeyword.get(key) ?? 0) + r.installs);
  }
  return { daily, byKeyword };
}

async function sdkAttributed(workspaceId: string, appId: number, dates: string[]) {
  const rows = await db.all<{ country: string; keyword: string; installs: number; revenue: number }>(
    `SELECT lower(COALESCE(i.country, '??')) AS country, i.keyword, COUNT(DISTINCT i.id)::int AS installs, COALESCE(SUM(r.amount_usd), 0) AS revenue
     FROM installs i LEFT JOIN revenue_events r ON r.workspace_id = i.workspace_id AND r.user_id = i.user_id AND (r.app_id IS NULL OR r.app_id = i.app_id) AND ${VALID_REVENUE}
     WHERE i.workspace_id = ? AND i.app_id = ? AND i.source = 'apple_ads' AND i.keyword IS NOT NULL
       AND analytics_day(i.installed_at) BETWEEN ?::date AND ?::date GROUP BY 1, 2`,
    [workspaceId, appId, dates[0], dates[dates.length - 1]],
  );
  return new Map(rows.map((r) => [`${r.country}|${normalizeTerm(r.keyword)}`, { installs: r.installs, revenue: Number(r.revenue) }]));
}

async function revenueByCountry(workspaceId: string, appId: number, dates: string[]) {
  const rows = await db.all<{ country: string; revenue: number }>(
    `SELECT lower(COALESCE(r.country, (SELECT i.country FROM installs i WHERE i.workspace_id = r.workspace_id AND i.user_id = r.user_id LIMIT 1), '??')) AS country,
            COALESCE(SUM(r.amount_usd), 0) AS revenue
     FROM revenue_events r WHERE r.workspace_id = ? AND r.app_id = ? AND ${VALID_REVENUE} AND analytics_day(r.occurred_at) BETWEEN ?::date AND ?::date GROUP BY 1`,
    [workspaceId, appId, dates[0], dates[dates.length - 1]],
  );
  return new Map(rows.map((r) => [r.country, Number(r.revenue)]));
}

function toModelKeywords(dates: string[], list: KeywordInput[]): ModelKeywordInput[] {
  return list.map((k) => ({
    key: k.key,
    keywordId: k.keywordId,
    term: k.term,
    country: k.country,
    popularitySource: k.popularitySource,
    track: dailyTrack(dates, k.snapshots, { position: k.position, popularity: k.popularity }),
    paidInstalls: k.paidInstalls,
    attributedRevenue: k.attributedRevenue,
  }));
}

function sumSeries(series: Iterable<number[]>) {
  let total = 0;
  for (const s of series) for (const v of s) total += v;
  return total;
}

async function computeLive(workspaceId: string, appId: number, days: ImpactDays, demoMode: ImpactDemoMode): Promise<Computed> {
  const app = await getApp(workspaceId, appId);
  const dates = windowDates(days);
  const [searchShare, tracked, found] = await Promise.all([getSearchShare(workspaceId), listKeywords(workspaceId, appId), detect(workspaceId, appId)]);
  const sources: SourceKeyword[] = tracked.map((k) => ({
    key: String(k.id),
    keywordId: k.id,
    term: k.term,
    country: k.country,
    popularity: k.popularity,
    popularitySource: k.popularitySource,
    position: k.position,
  }));
  const nothing = !found.posthog && !found.sdk && !found.revenue && !found.campaigns.length;
  if (demoMode === "only" || (demoMode === "auto" && nothing)) {
    const demo = demoInputs(`impact:${appId}`, dates, searchShare, demoKeywords(sources));
    const model = runModel({
      dates,
      searchShare,
      countries: demo.countries,
      keywords: toModelKeywords(dates, demo.keywords),
      appArpu: demo.appArpu,
      revenueAvailable: true,
    });
    return {
      demo: true,
      calibrated: true,
      dates,
      searchShare,
      revenueAvailable: true,
      model,
      otherCountries: demo.otherCountries,
      dataSources: { observed: "demo", posthog: "demo", sdk: "demo", revenue: "demo", appleAds: "demo", errors: [] },
    };
  }

  const errors: string[] = [];
  const countries = [...new Set(sources.map((k) => k.country))];
  let observedSource: ImpactDataSources["observed"] = "none";
  let observedByCountry = new Map<string, number[]>();
  let observedTotal = 0;
  let posthogState: ImpactDataSources["posthog"] = found.posthog ? "connected" : "missing";
  if (found.posthog) {
    try {
      const ph = await posthogObserved(workspaceId, appId, days, dates, countries);
      observedByCountry = ph.byCountry;
      observedTotal = ph.total;
      observedSource = "posthog";
    } catch (error) {
      posthogState = "error";
      errors.push(`PostHog: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const [sdk, ads, attributed, revenue, snapshots] = await Promise.all([
    found.sdk ? sdkInstalls(workspaceId, appId, dates) : null,
    adsInstalls(workspaceId, found.campaigns, app.primaryCountry, dates),
    found.sdk ? sdkAttributed(workspaceId, appId, dates) : new Map<string, { installs: number; revenue: number }>(),
    found.revenue ? revenueByCountry(workspaceId, appId, dates) : new Map<string, number>(),
    snapshotsFor(workspaceId, appId, dates[0]),
  ]);
  if (observedSource === "none" && sdk) {
    observedByCountry = sdk.observed;
    observedTotal = sdk.total;
    observedSource = "sdk";
  }
  const calibrated = observedSource !== "none";
  const n = dates.length;
  const paidCountries = new Set([...ads.daily.keys(), ...(sdk?.paid.keys() ?? [])]);
  const paidFor = (country: string) => {
    const a = ads.daily.get(country) ?? emptySeries(n);
    const s = sdk?.paid.get(country) ?? emptySeries(n);
    return a.map((v, i) => Math.max(v, s[i]));
  };
  const modelCountries: ModelCountryInput[] = countries.map((country) => ({
    country,
    observed: calibrated ? (observedByCountry.get(country) ?? emptySeries(n)) : null,
    paid: paidFor(country),
    revenue: found.revenue ? (revenue.get(country) ?? 0) : null,
  }));
  const keywords: KeywordInput[] = sources.map((k) => {
    const id = `${k.country}|${normalizeTerm(k.term)}`;
    const sdkRow = attributed.get(id);
    return {
      ...k,
      snapshots: snapshots.get(k.keywordId ?? -1) ?? [],
      paidInstalls: Math.max(ads.byKeyword.get(id) ?? 0, sdkRow?.installs ?? 0),
      attributedRevenue: found.revenue && sdkRow && sdkRow.installs > 0 ? sdkRow.revenue : null,
    };
  });
  const revenueTotal = [...revenue.values()].reduce((a, b) => a + b, 0);
  const appArpu = found.revenue && calibrated && observedTotal > 0 ? revenueTotal / observedTotal : null;
  const model = runModel({ dates, searchShare, countries: modelCountries, keywords: toModelKeywords(dates, keywords), appArpu, revenueAvailable: found.revenue && calibrated });
  const trackedSet = new Set(countries);
  const trackedObserved = calibrated ? sumSeries(countries.map((c) => observedByCountry.get(c) ?? [])) : 0;
  const untrackedPaid = sumSeries([...paidCountries].filter((c) => !trackedSet.has(c)).map(paidFor));
  return {
    demo: false,
    calibrated,
    dates,
    searchShare,
    revenueAvailable: found.revenue && calibrated,
    model,
    otherCountries: calibrated || untrackedPaid > 0 ? { observed: Math.max(0, observedTotal - trackedObserved), paid: untrackedPaid } : null,
    dataSources: {
      observed: observedSource,
      posthog: posthogState,
      sdk: found.sdk ? "connected" : "missing",
      revenue: found.revenue ? "connected" : "missing",
      appleAds: found.campaigns.length ? "connected" : "missing",
      errors,
    },
  };
}

export async function getKeywordImpact(workspaceId: string, appId: number, q: ImpactQuery = {}): Promise<ImpactResult> {
  await getApp(workspaceId, appId);
  const days = impactDays(q.days);
  const demoMode = q.demo ?? "auto";
  const country = q.country && q.country !== "all" ? q.country.toLowerCase() : "all";
  const c = await cached<Computed>(wsKey(workspaceId, `impact:${appId}:${days}:${demoMode}`), TTL, () => computeLive(workspaceId, appId, days, demoMode));
  const scope = scopeOf(c.model, country);
  return {
    demo: c.demo,
    notice: c.demo ? IMPACT_DEMO_NOTICE : null,
    calibrated: c.calibrated,
    appId,
    country,
    days,
    from: c.dates[0],
    to: c.dates[c.dates.length - 1],
    dates: c.dates,
    searchShare: c.searchShare,
    revenueAvailable: c.revenueAvailable,
    totals: totalsOf(scope.countries, scope.keywords),
    otherCountries: country === "all" ? c.otherCountries : null,
    countries: scope.countries.map(publicCountry),
    keywords: scope.keywords,
    chart: chartOf(c.dates, scope.countries, scope.keywords),
    geography: geographyOf(c.model.countries),
    dataSources: c.dataSources,
  };
}

export async function clearImpactCache(workspaceId: string) {
  await cacheDelete(wsKey(workspaceId, "impact:"));
}
