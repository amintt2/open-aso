import { getApp } from "@/lib/aso/apps";
import { isAscConfigured } from "@/lib/asc/client";
import { cached } from "@/lib/server/cache";
import { db, parseJson } from "@/lib/server/db";
import { analyticsCachePrefix, dataSinceFor, dataThroughFor } from "./coverage";
import { fixtureDailyRows } from "./fixtures";
import { emptyMetrics } from "./parse";
import { loadRequests } from "./requests";
import { addDays, isUpToDate, utcDay } from "./schedule";
import type {
  AccessType,
  DailyRow,
  Metrics,
  Period,
  SourceBreakdown,
  SourceType,
  StoreAnalyticsResult,
  StoreDays,
  StorePoint,
  StoreStatus,
  StoreSummary,
  StoreTotals,
  SyncInfo,
  SyncLogEntry,
  TerritoryBreakdown,
} from "./types";

export type * from "./types";

export const DEMO_NOTICE = "Sample data: these numbers are generated to preview App Store Analytics. Connect App Store Connect to see your real impressions, page views and downloads.";

const TTL = 10 * 60 * 1000;
const SOURCE_ORDER: SourceType[] = ["search", "browse", "app_referrer", "web_referrer", "app_clip", "notification", "institutional", "in_store", "unavailable", "other"];

export function storeDays(value: unknown): StoreDays {
  const n = Number(value);
  return n === 7 || n === 90 || n === 180 ? n : 30;
}

const SUMS = `sum(impressions)::float8 AS impressions, sum(impressions_unique)::float8 AS "impressionsUnique", sum(page_views)::float8 AS "pageViews",
  sum(page_views_unique)::float8 AS "pageViewsUnique", sum(first_downloads)::float8 AS "firstDownloads", sum(redownloads)::float8 AS redownloads,
  sum(updates)::float8 AS updates, sum(purchases)::float8 AS purchases, sum(proceeds_usd)::float8 AS proceeds, sum(sales_usd)::float8 AS sales`;

const METRIC_KEYS = Object.keys(emptyMetrics()) as (keyof Metrics)[];

function add(target: Metrics, row: Metrics) {
  for (const k of METRIC_KEYS) target[k] += Number(row[k]) || 0;
}

function ratio(a: number, b: number) {
  return b > 0 ? a / b : null;
}

function point(date: string, m: Metrics): StorePoint {
  return {
    date,
    impressions: m.impressions,
    impressionsUnique: m.impressionsUnique,
    pageViews: m.pageViews,
    pageViewsUnique: m.pageViewsUnique,
    firstDownloads: m.firstDownloads,
    redownloads: m.redownloads,
    updates: m.updates,
    proceeds: Math.round(m.proceeds * 100) / 100,
    conversion: ratio(m.firstDownloads, m.impressionsUnique),
    pageViewConversion: ratio(m.firstDownloads, m.pageViewsUnique),
  };
}

function period(current: number, previous: number | null): Period {
  return { current, previous };
}

function totalsOf(cur: Metrics, prev: Metrics | null): StoreTotals {
  const p = (k: keyof Metrics) => period(cur[k], prev ? prev[k] : null);
  return {
    impressions: p("impressions"),
    impressionsUnique: p("impressionsUnique"),
    pageViews: p("pageViews"),
    pageViewsUnique: p("pageViewsUnique"),
    firstDownloads: p("firstDownloads"),
    redownloads: p("redownloads"),
    updates: p("updates"),
    proceeds: p("proceeds"),
    conversion: { current: ratio(cur.firstDownloads, cur.impressionsUnique) ?? 0, previous: prev ? ratio(prev.firstDownloads, prev.impressionsUnique) : null },
    pageViewConversion: { current: ratio(cur.firstDownloads, cur.pageViewsUnique) ?? 0, previous: prev ? ratio(prev.firstDownloads, prev.pageViewsUnique) : null },
  };
}

type Grouped = { daySource: DailyRow[]; territories: (Metrics & { territory: string; cur: boolean })[] };

type Window = { from: string; to: string; prevFrom: string; prevTo: string; hasPrevious: boolean; dates: string[] };

function windowFor(dataThrough: string, days: number, dataSince: string | null): Window {
  const from = addDays(dataThrough, -(days - 1));
  const prevFrom = addDays(from, -days);
  const dates = Array.from({ length: days }, (_, i) => addDays(from, i));
  return { from, to: dataThrough, prevFrom, prevTo: addDays(from, -1), hasPrevious: dataSince != null && dataSince <= prevFrom, dates };
}

function build(appId: number, days: StoreDays, country: string, w: Window, g: Grouped): Omit<StoreAnalyticsResult, "status" | "demo" | "notice" | "message" | "sync" | "availableTerritories"> {
  const byDate = new Map<string, Metrics>();
  const bySource = new Map<SourceType, { cur: Metrics; prev: Metrics }>();
  const sourceDaily = new Map<string, Record<string, number | string>>();
  const cur = emptyMetrics();
  const prev = emptyMetrics();
  for (const r of g.daySource) {
    const inCur = r.date >= w.from;
    add(inCur ? cur : prev, r);
    const s = bySource.get(r.source) ?? { cur: emptyMetrics(), prev: emptyMetrics() };
    add(inCur ? s.cur : s.prev, r);
    bySource.set(r.source, s);
    if (!inCur) continue;
    const d = byDate.get(r.date) ?? emptyMetrics();
    add(d, r);
    byDate.set(r.date, d);
    const sd = sourceDaily.get(r.date) ?? { date: r.date };
    sd[`${r.source}:firstDownloads`] = (Number(sd[`${r.source}:firstDownloads`]) || 0) + r.firstDownloads;
    sd[`${r.source}:impressions`] = (Number(sd[`${r.source}:impressions`]) || 0) + r.impressions;
    sd[`${r.source}:pageViews`] = (Number(sd[`${r.source}:pageViews`]) || 0) + r.pageViews;
    sourceDaily.set(r.date, sd);
  }
  const totalFirst = cur.firstDownloads;
  const sources: SourceBreakdown[] = [...bySource.entries()]
    .filter(([, v]) => v.cur.impressions + v.cur.firstDownloads + v.cur.pageViews + v.cur.redownloads > 0)
    .map(([source, v]) => ({
      source,
      impressions: v.cur.impressions,
      pageViews: v.cur.pageViews,
      firstDownloads: v.cur.firstDownloads,
      redownloads: v.cur.redownloads,
      previousFirstDownloads: w.hasPrevious ? v.prev.firstDownloads : null,
      conversion: ratio(v.cur.firstDownloads, v.cur.impressionsUnique),
      share: ratio(v.cur.firstDownloads, totalFirst),
    }))
    .sort((a, b) => b.firstDownloads - a.firstDownloads || SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source));
  const terr = new Map<string, { cur: Metrics & { impressionsUnique: number }; prev: Metrics }>();
  for (const r of g.territories) {
    const t = terr.get(r.territory) ?? { cur: emptyMetrics(), prev: emptyMetrics() };
    add(r.cur ? t.cur : t.prev, r);
    terr.set(r.territory, t);
  }
  const territories: TerritoryBreakdown[] = [...terr.entries()]
    .filter(([, v]) => v.cur.impressions + v.cur.firstDownloads > 0)
    .map(([territory, v]) => ({
      territory,
      impressions: v.cur.impressions,
      pageViews: v.cur.pageViews,
      firstDownloads: v.cur.firstDownloads,
      redownloads: v.cur.redownloads,
      previousFirstDownloads: w.hasPrevious ? v.prev.firstDownloads : null,
      conversion: ratio(v.cur.firstDownloads, v.cur.impressionsUnique),
      proceeds: Math.round(v.cur.proceeds * 100) / 100,
    }))
    .sort((a, b) => b.firstDownloads - a.firstDownloads || b.impressions - a.impressions);
  return {
    appId,
    country,
    days,
    from: w.from,
    to: w.to,
    dataThrough: w.to,
    totals: totalsOf(cur, w.hasPrevious ? prev : null),
    daily: w.dates.map((d) => point(d, byDate.get(d) ?? emptyMetrics())),
    sources,
    sourceDaily: w.dates.map((d) => sourceDaily.get(d) ?? { date: d }),
    territories,
  };
}

async function grouped(workspaceId: string, appId: number, country: string, w: Window): Promise<Grouped> {
  const countryFilter = country === "all" ? "" : " AND territory = ?";
  const countryArgs = country === "all" ? [] : [country];
  const [daySource, territories] = await Promise.all([
    db.all<DailyRow>(
      `SELECT date, '*' AS territory, source_type AS source, ${SUMS} FROM asc_analytics_daily
       WHERE workspace_id = ? AND app_id = ? AND date BETWEEN ?::date AND ?::date${countryFilter} GROUP BY date, source_type`,
      [workspaceId, appId, w.prevFrom, w.to, ...countryArgs],
    ),
    db.all<Metrics & { territory: string; cur: boolean }>(
      `SELECT territory, date >= ?::date AS cur, ${SUMS} FROM asc_analytics_daily
       WHERE workspace_id = ? AND app_id = ? AND date BETWEEN ?::date AND ?::date GROUP BY 1, 2`,
      [w.from, workspaceId, appId, w.prevFrom, w.to],
    ),
  ]);
  return { daySource, territories };
}

function groupDemo(rows: DailyRow[], country: string, w: Window): Grouped {
  const ds = new Map<string, DailyRow>();
  const tr = new Map<string, Metrics & { territory: string; cur: boolean }>();
  for (const r of rows) {
    const cur = r.date >= w.from;
    const tk = `${r.territory}|${cur}`;
    const t = tr.get(tk) ?? { territory: r.territory, cur, ...emptyMetrics() };
    add(t, r);
    tr.set(tk, t);
    if (country !== "all" && r.territory !== country) continue;
    const k = `${r.date}|${r.source}`;
    const d = ds.get(k) ?? { date: r.date, territory: "*", source: r.source, ...emptyMetrics() };
    add(d, r);
    ds.set(k, d);
  }
  return { daySource: [...ds.values()], territories: [...tr.values()] };
}

type SyncRow = {
  demo: boolean;
  last_processing_date: string | null;
  data_through: string | null;
  fresh_day: string | null;
  last_check_at: string | null;
  next_check_at: string | null;
  check_day: string | null;
  api_calls_today: number;
  api_calls_total: number;
  publish_minute: number | null;
  last_error: string | null;
  log: unknown;
};

async function syncInfo(workspaceId: string, appId: number): Promise<SyncInfo & { hasRequests: boolean }> {
  const today = utcDay(Date.now());
  const [row, requests, ws] = await Promise.all([
    db.get<SyncRow>("SELECT * FROM asc_analytics_sync WHERE workspace_id = ? AND app_id = ?", [workspaceId, appId]),
    loadRequests(workspaceId, appId),
    db.get<{ calls: number }>("SELECT COALESCE(sum(api_calls_today), 0)::int AS calls FROM asc_analytics_sync WHERE workspace_id = ? AND check_day = ?::date", [workspaceId, today]),
  ]);
  const live = requests.filter((r) => !r.requestId.startsWith("unavailable:"));
  const snapshot = requests.find((r) => r.accessType === "ONE_TIME_SNAPSHOT");
  const ongoing = requests.find((r) => r.accessType === "ONGOING" && !r.stopped);
  return {
    hasRequests: live.length > 0,
    demo: row?.demo ?? requests.some((r) => r.demo),
    requestedAt: ongoing?.createdAt ?? live[0]?.createdAt ?? null,
    accessTypes: [...new Set(live.filter((r) => !r.stopped || r.completedAt).map((r) => r.accessType))] as AccessType[],
    snapshot: !snapshot || snapshot.requestId.startsWith("unavailable:") ? "none" : snapshot.completedAt ? "done" : "pending",
    lastCheckAt: row?.last_check_at ?? null,
    nextCheckAt: row?.next_check_at ?? null,
    lastProcessingDate: row?.last_processing_date ?? null,
    dataThrough: row?.data_through ?? null,
    upToDate: row ? isUpToDate({ dataThrough: row.data_through, freshDay: row.fresh_day }, Date.now()) : false,
    publishMinuteUtc: row?.publish_minute ?? null,
    apiCallsToday: row?.check_day === today ? row.api_calls_today : 0,
    apiCallsTotal: row?.api_calls_total ?? 0,
    workspaceCallsToday: ws?.calls ?? 0,
    lastError: row?.last_error ?? ongoing?.lastError ?? null,
    log: parseJson<SyncLogEntry[]>(row?.log, []),
  };
}

function emptySync(): SyncInfo {
  return {
    demo: false,
    requestedAt: null,
    accessTypes: [],
    snapshot: "none",
    lastCheckAt: null,
    nextCheckAt: null,
    lastProcessingDate: null,
    dataThrough: null,
    upToDate: false,
    publishMinuteUtc: null,
    apiCallsToday: 0,
    apiCallsTotal: 0,
    workspaceCallsToday: 0,
    lastError: null,
    log: [],
  };
}

export type StoreQuery = { days?: number; country?: string | null; demo?: "never" | "auto" | "only" };

async function demoResult(appId: number, trackId: number, name: string, days: StoreDays, country: string): Promise<StoreAnalyticsResult> {
  const to = addDays(utcDay(Date.now()), -1);
  const w = windowFor(to, days, addDays(to, -400));
  const rows = fixtureDailyRows({ ascAppId: String(trackId), name, seed: trackId }, [...Array.from({ length: days }, (_, i) => addDays(w.prevFrom, i)), ...w.dates]);
  const base = build(appId, days, country, w, groupDemo(rows, country, w));
  return {
    ...base,
    status: "ok",
    demo: true,
    notice: DEMO_NOTICE,
    message: null,
    availableTerritories: [...new Set(rows.map((r) => r.territory))].sort(),
    sync: { ...emptySync(), demo: true, dataThrough: to, upToDate: true },
  };
}

function emptyResult(appId: number, days: StoreDays, country: string, status: StoreStatus, sync: SyncInfo, message: string | null): StoreAnalyticsResult {
  return {
    appId,
    status,
    demo: sync.demo,
    notice: null,
    message,
    country,
    days,
    from: null,
    to: null,
    dataThrough: null,
    totals: null,
    daily: [],
    sources: [],
    sourceDaily: [],
    territories: [],
    availableTerritories: [],
    sync,
  };
}

export async function getStoreAnalytics(workspaceId: string, appId: number, q: StoreQuery = {}): Promise<StoreAnalyticsResult> {
  const app = await getApp(workspaceId, appId);
  const days = storeDays(q.days);
  const country = q.country && q.country !== "all" ? q.country.toLowerCase() : "all";
  const mode = q.demo ?? "never";
  if (mode === "only") return demoResult(appId, app.trackId, app.name, days, country);
  const [configured, info, dataThrough, dataSince] = await Promise.all([isAscConfigured(workspaceId), syncInfo(workspaceId, appId), dataThroughFor(workspaceId, appId), dataSinceFor(workspaceId, appId)]);
  const { hasRequests, ...sync } = info;
  if (!dataThrough) {
    if (!configured && !sync.demo) return mode === "auto" ? demoResult(appId, app.trackId, app.name, days, country) : emptyResult(appId, days, country, "not_connected", sync, null);
    if (!app.ascAppId && !sync.demo && !hasRequests) return emptyResult(appId, days, country, sync.lastError ? "error" : "not_linked", sync, sync.lastError);
    if (!hasRequests) return emptyResult(appId, days, country, sync.lastError ? "error" : "not_requested", sync, sync.lastError);
    return emptyResult(appId, days, country, sync.lastError ? "error" : "waiting", sync, sync.lastError);
  }
  const w = windowFor(dataThrough, days, dataSince);
  const key = `${analyticsCachePrefix(workspaceId)}${appId}:${days}:${country}:${dataThrough}`;
  const base = await cached(key, TTL, async () => build(appId, days, country, w, await grouped(workspaceId, appId, country, w)));
  const terr = await db.all<{ territory: string }>("SELECT DISTINCT territory FROM asc_analytics_daily WHERE workspace_id = ? AND app_id = ? AND date >= ?::date", [workspaceId, appId, w.prevFrom]);
  return {
    ...base,
    status: "ok",
    demo: sync.demo,
    notice: sync.demo ? "Sample data loaded from fixtures (development). Connect App Store Connect and sync to replace it." : null,
    message: sync.lastError,
    availableTerritories: terr.map((t) => t.territory).sort(),
    sync: { ...sync, dataThrough },
  };
}

export async function getStoreSummary(workspaceId: string, appId: number | null): Promise<StoreSummary> {
  const appFilter = appId ? " AND app_id = ?" : "";
  const appArgs = appId ? [appId] : [];
  const apps = await db.all<{ app_id: number; data_through: string; demo: boolean }>(
    `SELECT s.app_id, s.data_through, s.demo FROM asc_analytics_sync s JOIN apps a ON a.id = s.app_id AND a.workspace_id = s.workspace_id
     WHERE s.workspace_id = ? AND s.data_through IS NOT NULL${appFilter.replace("app_id", "s.app_id")}`,
    [workspaceId, ...appArgs],
  );
  if (!apps.length) {
    const configured = await isAscConfigured(workspaceId);
    return { state: configured ? "no_data" : "not_connected", demo: false, dataThrough: null, apps: 0, impressions: null, pageViews: null, firstDownloads: null, conversion: null };
  }
  const to = apps.reduce((m, a) => (a.data_through > m ? a.data_through : m), apps[0].data_through);
  const from = addDays(to, -6);
  const prevFrom = addDays(to, -13);
  const since = await db.get<{ d: string | null }>(`SELECT min(date) AS d FROM asc_analytics_coverage WHERE workspace_id = ?${appFilter}`, [workspaceId, ...appArgs]);
  const hasPrevious = !!since?.d && since.d <= prevFrom;
  const rows = await db.all<Metrics & { cur: boolean }>(
    `SELECT date >= ?::date AS cur, ${SUMS} FROM asc_analytics_daily WHERE workspace_id = ?${appFilter} AND date BETWEEN ?::date AND ?::date GROUP BY 1`,
    [from, workspaceId, ...appArgs, prevFrom, to],
  );
  const cur = emptyMetrics();
  const prev = emptyMetrics();
  for (const r of rows) add(r.cur ? cur : prev, r);
  const p = (k: keyof Metrics) => ({ current: cur[k], previous: hasPrevious ? prev[k] : null });
  return {
    state: "ok",
    demo: apps.some((a) => a.demo),
    dataThrough: to,
    apps: apps.length,
    impressions: p("impressions"),
    pageViews: p("pageViews"),
    firstDownloads: p("firstDownloads"),
    conversion: { current: ratio(cur.firstDownloads, cur.impressionsUnique) ?? 0, previous: hasPrevious ? ratio(prev.firstDownloads, prev.impressionsUnique) : null },
  };
}

export type AppleDownloads = {
  dataThrough: string;
  knownDays: number;
  search: Map<string, (number | null)[]>;
  total: Map<string, (number | null)[]>;
  allTotal: (number | null)[];
};

export async function appleDownloadsByCountry(workspaceId: string, appId: number, dates: string[]): Promise<AppleDownloads | null> {
  if (!dates.length) return null;
  const [through, since] = await Promise.all([dataThroughFor(workspaceId, appId), dataSinceFor(workspaceId, appId)]);
  if (!through || !since) return null;
  const known = dates.map((d) => d >= since && d <= through);
  const knownDays = known.filter(Boolean).length;
  if (!knownDays) return null;
  const rows = await db.all<{ date: string; territory: string; search: number; total: number }>(
    `SELECT date, territory, sum(first_downloads) FILTER (WHERE source_type = 'search')::float8 AS search, sum(first_downloads)::float8 AS total
     FROM asc_analytics_daily WHERE workspace_id = ? AND app_id = ? AND date BETWEEN ?::date AND ?::date GROUP BY 1, 2`,
    [workspaceId, appId, dates[0], dates[dates.length - 1]],
  );
  const index = new Map(dates.map((d, i) => [d, i]));
  const blank = (): (number | null)[] => known.map((k) => (k ? 0 : null));
  const search = new Map<string, (number | null)[]>();
  const total = new Map<string, (number | null)[]>();
  const allTotal = blank();
  for (const r of rows) {
    const i = index.get(r.date);
    if (i == null || !known[i]) continue;
    const s = search.get(r.territory) ?? blank();
    const t = total.get(r.territory) ?? blank();
    s[i] = (s[i] ?? 0) + (Number(r.search) || 0);
    t[i] = (t[i] ?? 0) + (Number(r.total) || 0);
    allTotal[i] = (allTotal[i] ?? 0) + (Number(r.total) || 0);
    search.set(r.territory, s);
    total.set(r.territory, t);
  }
  return { dataThrough: through, knownDays, search, total, allTotal };
}
