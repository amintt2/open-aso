import type Database from "better-sqlite3";
import { analyticsDb } from "./schema";
import { demoDb, DEMO_NOTICE } from "./demo";
import type {
  AnalyticsQuery,
  CityRow,
  CountryRow,
  GeographyResult,
  KeywordRoasResult,
  KeywordRoasRow,
  KeywordTrendResult,
  OverviewResult,
  OverviewTotals,
  RetentionCohort,
  RetentionResult,
  SourceRow,
  SourcesResult,
} from "./types";

export type * from "./types";

const PURCHASE_TYPES = "('initial_purchase','trial_converted','non_renewing_purchase')";
const DAY_MS = 86400000;

type Ctx = {
  d: Database.Database;
  demo: boolean;
  days: number;
  params: { appId: number | null; from: string; to: string; prevFrom: string; prevTo: string; sandbox: number; today: string };
};

const validRevenue = `r.type NOT IN ('test','other') AND (@appId IS NULL OR r.app_id = @appId) AND (@sandbox = 1 OR COALESCE(json_extract(r.raw, '$.environment'), '') != 'SANDBOX')`;
const appInstalls = `(@appId IS NULL OR i.app_id = @appId)`;

function isoDay(t: number) {
  return new Date(t).toISOString().slice(0, 10);
}

export function periodDays(value: unknown) {
  const n = Number(value);
  return [7, 30, 90].includes(n) ? n : 30;
}

function hasRealData(appId: number | null) {
  const d = analyticsDb();
  const row = d
    .prepare(
      `SELECT EXISTS(SELECT 1 FROM installs i WHERE ${appInstalls}) AS installs,
              EXISTS(SELECT 1 FROM revenue_events r WHERE r.type NOT IN ('test','other') AND (@appId IS NULL OR r.app_id = @appId)) AS revenue`,
    )
    .get({ appId }) as { installs: number; revenue: number };
  return !!(row.installs || row.revenue);
}

function context(q: AnalyticsQuery = {}): Ctx {
  const days = periodDays(q.days ?? 30);
  const mode = q.demo ?? "never";
  const appId = q.appId ?? null;
  const demo = mode === "only" || (mode === "auto" && !hasRealData(appId));
  const now = Date.now();
  const to = isoDay(now);
  const from = isoDay(now - (days - 1) * DAY_MS);
  const prevTo = isoDay(now - days * DAY_MS);
  const prevFrom = isoDay(now - (2 * days - 1) * DAY_MS);
  return {
    d: demo ? demoDb() : analyticsDb(),
    demo,
    days,
    params: { appId: demo ? null : appId, from, to, prevFrom, prevTo, sandbox: q.includeSandbox ? 1 : 0, today: to },
  };
}

function meta(ctx: Ctx) {
  return { demo: ctx.demo, notice: ctx.demo ? DEMO_NOTICE : null, from: ctx.params.from, to: ctx.params.to, days: ctx.days };
}

function dateRange(from: string, to: string) {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += DAY_MS) out.push(isoDay(t));
  return out;
}

function ratio(a: number, b: number) {
  return b > 0 ? a / b : null;
}

function costPer(spend: number, count: number) {
  return spend > 0 && count > 0 ? spend / count : null;
}

function totalsFor(ctx: Ctx, from: string, to: string): OverviewTotals {
  const p = { ...ctx.params, from, to };
  const installs = (ctx.d.prepare(`SELECT COUNT(*) AS n FROM installs i WHERE ${appInstalls} AND substr(i.installed_at, 1, 10) BETWEEN @from AND @to`).get(p) as { n: number }).n;
  const r = ctx.d
    .prepare(
      `SELECT COALESCE(SUM(r.type = 'trial_started'), 0) AS trials,
              COALESCE(SUM(r.type IN ${PURCHASE_TYPES}), 0) AS purchases,
              COALESCE(SUM(r.type = 'trial_converted'), 0) AS conversions,
              COALESCE(SUM(CASE WHEN r.amount_usd > 0 THEN r.amount_usd ELSE 0 END), 0) AS gross,
              COALESCE(SUM(CASE WHEN r.amount_usd < 0 THEN -r.amount_usd ELSE 0 END), 0) AS refunds,
              COUNT(DISTINCT CASE WHEN r.amount_usd > 0 THEN r.user_id END) AS payers
       FROM revenue_events r WHERE ${validRevenue} AND substr(r.occurred_at, 1, 10) BETWEEN @from AND @to`,
    )
    .get(p) as { trials: number; purchases: number; conversions: number; gross: number; refunds: number; payers: number };
  return {
    installs,
    trials: r.trials,
    purchases: r.purchases,
    grossRevenue: r.gross,
    refunds: r.refunds,
    netRevenue: r.gross - r.refunds,
    payingUsers: r.payers,
    trialConversion: ratio(r.conversions, r.trials),
  };
}

export function getOverview(q?: AnalyticsQuery): OverviewResult {
  const ctx = context(q);
  const { from, to } = ctx.params;
  const installs = new Map(
    (ctx.d.prepare(`SELECT substr(i.installed_at, 1, 10) AS day, COUNT(*) AS n FROM installs i WHERE ${appInstalls} AND substr(i.installed_at, 1, 10) BETWEEN @from AND @to GROUP BY day`).all(ctx.params) as { day: string; n: number }[]).map(
      (r) => [r.day, r.n],
    ),
  );
  const revenue = new Map(
    (
      ctx.d
        .prepare(
          `SELECT substr(r.occurred_at, 1, 10) AS day, SUM(r.type = 'trial_started') AS trials, SUM(r.type IN ${PURCHASE_TYPES}) AS purchases,
                  SUM(CASE WHEN r.amount_usd > 0 THEN r.amount_usd ELSE 0 END) AS gross, SUM(CASE WHEN r.amount_usd < 0 THEN -r.amount_usd ELSE 0 END) AS refunds
           FROM revenue_events r WHERE ${validRevenue} AND substr(r.occurred_at, 1, 10) BETWEEN @from AND @to GROUP BY day`,
        )
        .all(ctx.params) as { day: string; trials: number; purchases: number; gross: number; refunds: number }[]
    ).map((r) => [r.day, r]),
  );
  const series = dateRange(from, to).map((date) => {
    const r = revenue.get(date);
    return {
      date,
      installs: installs.get(date) ?? 0,
      trials: r?.trials ?? 0,
      purchases: r?.purchases ?? 0,
      grossRevenue: r?.gross ?? 0,
      refunds: r?.refunds ?? 0,
      netRevenue: (r?.gross ?? 0) - (r?.refunds ?? 0),
    };
  });
  return { ...meta(ctx), totals: totalsFor(ctx, from, to), previous: totalsFor(ctx, ctx.params.prevFrom, ctx.params.prevTo), series };
}

const cohortRevenueJoin = `LEFT JOIN revenue_events r ON r.user_id = i.user_id AND (r.app_id IS NULL OR r.app_id = i.app_id) AND ${validRevenue}`;

export function getSources(q?: AnalyticsQuery): SourcesResult {
  const ctx = context(q);
  const rows = ctx.d
    .prepare(
      `SELECT i.source AS source, COUNT(DISTINCT i.id) AS installs,
              COUNT(DISTINCT CASE WHEN r.type = 'trial_started' THEN i.id END) AS trials,
              COUNT(DISTINCT CASE WHEN r.amount_usd > 0 THEN i.id END) AS payers,
              COALESCE(SUM(r.amount_usd), 0) AS revenue
       FROM installs i ${cohortRevenueJoin}
       WHERE ${appInstalls} AND substr(i.installed_at, 1, 10) BETWEEN @from AND @to
       GROUP BY i.source`,
    )
    .all(ctx.params) as { source: string; installs: number; trials: number; payers: number; revenue: number }[];
  const sources: SourceRow[] = ["apple_ads", "organic"].map((source) => {
    const r = rows.find((x) => x.source === source) ?? { installs: 0, trials: 0, payers: 0, revenue: 0 };
    return { source: source as SourceRow["source"], installs: r.installs, trials: r.trials, payers: r.payers, revenue: r.revenue, trialRate: ratio(r.trials, r.installs), conversion: ratio(r.payers, r.installs), revenuePerInstall: ratio(r.revenue, r.installs) };
  });
  const unattributed = (
    ctx.d
      .prepare(
        `SELECT COALESCE(SUM(r.amount_usd), 0) AS revenue FROM revenue_events r
         WHERE ${validRevenue} AND substr(r.occurred_at, 1, 10) BETWEEN @from AND @to
           AND NOT EXISTS (SELECT 1 FROM installs i WHERE i.user_id = r.user_id)`,
      )
      .get(ctx.params) as { revenue: number }
  ).revenue;
  const daily = new Map<string, { date: string; apple_ads: number; organic: number }>(dateRange(ctx.params.from, ctx.params.to).map((date) => [date, { date, apple_ads: 0, organic: 0 }]));
  for (const r of ctx.d
    .prepare(`SELECT substr(i.installed_at, 1, 10) AS day, i.source AS source, COUNT(*) AS n FROM installs i WHERE ${appInstalls} AND substr(i.installed_at, 1, 10) BETWEEN @from AND @to GROUP BY day, source`)
    .all(ctx.params) as { day: string; source: string; n: number }[]) {
    const entry = daily.get(r.day);
    if (entry && (r.source === "apple_ads" || r.source === "organic")) entry[r.source] += r.n;
  }
  const campaigns = ctx.d
    .prepare(
      `SELECT i.campaign_id AS campaignId, COUNT(DISTINCT i.id) AS installs,
              COUNT(DISTINCT CASE WHEN r.type = 'trial_started' THEN i.id END) AS trials,
              COALESCE(SUM(r.amount_usd), 0) AS revenue,
              (SELECT COALESCE(SUM(a.spend), 0) FROM ads_keyword_daily a WHERE a.campaign_id = i.campaign_id AND a.date BETWEEN @from AND @to) AS spend
       FROM installs i ${cohortRevenueJoin}
       WHERE ${appInstalls} AND i.source = 'apple_ads' AND i.campaign_id IS NOT NULL AND substr(i.installed_at, 1, 10) BETWEEN @from AND @to
       GROUP BY i.campaign_id ORDER BY installs DESC LIMIT 20`,
    )
    .all(ctx.params) as { campaignId: string; installs: number; trials: number; revenue: number; spend: number }[];
  return {
    ...meta(ctx),
    sources,
    unattributedRevenue: unattributed,
    daily: [...daily.values()],
    campaigns: campaigns.map((c) => ({ ...c, roas: ratio(c.revenue, c.spend) })),
  };
}

export function getGeography(q?: AnalyticsQuery): GeographyResult {
  const ctx = context(q);
  const installs = ctx.d
    .prepare(`SELECT COALESCE(i.country, '??') AS country, COUNT(*) AS installs FROM installs i WHERE ${appInstalls} AND substr(i.installed_at, 1, 10) BETWEEN @from AND @to GROUP BY 1`)
    .all(ctx.params) as { country: string; installs: number }[];
  const revenue = ctx.d
    .prepare(
      `SELECT COALESCE(r.country, (SELECT i.country FROM installs i WHERE i.user_id = r.user_id LIMIT 1), '??') AS country,
              COALESCE(SUM(r.amount_usd), 0) AS revenue, SUM(r.type = 'trial_started') AS trials, COUNT(DISTINCT CASE WHEN r.amount_usd > 0 THEN r.user_id END) AS payers
       FROM revenue_events r WHERE ${validRevenue} AND substr(r.occurred_at, 1, 10) BETWEEN @from AND @to GROUP BY 1`,
    )
    .all(ctx.params) as { country: string; revenue: number; trials: number; payers: number }[];
  const map = new Map<string, CountryRow>();
  const entry = (country: string) => {
    const existing = map.get(country);
    if (existing) return existing;
    const row: CountryRow = { country, installs: 0, trials: 0, payers: 0, revenue: 0, revenuePerInstall: null };
    map.set(country, row);
    return row;
  };
  for (const r of installs) entry(r.country).installs += r.installs;
  for (const r of revenue) {
    const row = entry(r.country);
    row.revenue += r.revenue;
    row.trials += r.trials;
    row.payers += r.payers;
  }
  const countries = [...map.values()].map((r) => ({ ...r, revenuePerInstall: ratio(r.revenue, r.installs) })).sort((a, b) => b.installs - a.installs || b.revenue - a.revenue);
  const cities = ctx.d
    .prepare(
      `SELECT i.city AS city, i.country AS country, COUNT(DISTINCT i.id) AS installs, COALESCE(SUM(r.amount_usd), 0) AS revenue
       FROM installs i ${cohortRevenueJoin}
       WHERE ${appInstalls} AND i.city IS NOT NULL AND i.city != '' AND substr(i.installed_at, 1, 10) BETWEEN @from AND @to
       GROUP BY i.city, i.country ORDER BY installs DESC LIMIT 25`,
    )
    .all(ctx.params) as CityRow[];
  return { ...meta(ctx), countries, cities };
}

export function getRetention(q?: AnalyticsQuery): RetentionResult {
  const ctx = context(q);
  const weekly = ctx.days > 7;
  const cohortExpr = weekly ? "date(i.installed_at, '-6 days', 'weekday 1')" : "date(i.installed_at)";
  const retained = (n: number) =>
    `SUM(CASE WHEN date(i.installed_at, '+${n} days') <= @today THEN 1 ELSE 0 END) AS e${n},
     SUM(CASE WHEN date(i.installed_at, '+${n} days') <= @today AND EXISTS (SELECT 1 FROM analytics_sessions s WHERE s.app_id = i.app_id AND s.user_id = i.user_id AND s.date = date(i.installed_at, '+${n} days')) THEN 1 ELSE 0 END) AS r${n}`;
  const rows = ctx.d
    .prepare(
      `SELECT ${cohortExpr} AS cohort, COUNT(*) AS installs, ${retained(1)}, ${retained(7)}, ${retained(30)}
       FROM installs i WHERE ${appInstalls} AND substr(i.installed_at, 1, 10) BETWEEN @from AND @to
       GROUP BY cohort ORDER BY cohort DESC`,
    )
    .all(ctx.params) as { cohort: string; installs: number; e1: number; r1: number; e7: number; r7: number; e30: number; r30: number }[];
  const cohorts: RetentionCohort[] = rows.map((r) => ({
    cohort: r.cohort,
    installs: r.installs,
    d1: ratio(r.r1, r.e1),
    d7: ratio(r.r7, r.e7),
    d30: ratio(r.r30, r.e30),
    eligible: { d1: r.e1, d7: r.e7, d30: r.e30 },
  }));
  const sum = (k: "r1" | "e1" | "r7" | "e7" | "r30" | "e30") => rows.reduce((acc, r) => acc + r[k], 0);
  const sessions = (ctx.d.prepare(`SELECT COUNT(*) AS n FROM analytics_sessions s WHERE (@appId IS NULL OR s.app_id = @appId) AND s.date BETWEEN @from AND @to`).get(ctx.params) as { n: number }).n;
  return {
    ...meta(ctx),
    granularity: weekly ? "week" : "day",
    cohorts,
    average: { d1: ratio(sum("r1"), sum("e1")), d7: ratio(sum("r7"), sum("e7")), d30: ratio(sum("r30"), sum("e30")) },
    sessionDays: sessions,
  };
}

function campaignFilter(d: Database.Database) {
  const tables = new Set((d.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((t) => t.name));
  const clauses = ["a.campaign_id IN (SELECT DISTINCT campaign_id FROM installs WHERE app_id = @appId AND campaign_id IS NOT NULL)"];
  for (const table of ["ads_campaigns", "apple_ads_campaigns"]) {
    if (!tables.has(table)) continue;
    const cols = new Set((d.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name));
    const idCol = cols.has("campaign_id") ? "campaign_id" : cols.has("id") ? "id" : null;
    if (!idCol) continue;
    if (cols.has("app_id")) clauses.push(`a.campaign_id IN (SELECT CAST(${idCol} AS TEXT) FROM ${table} WHERE app_id = @appId)`);
    const adam = cols.has("adam_id") ? "adam_id" : cols.has("track_id") ? "track_id" : null;
    if (adam) clauses.push(`a.campaign_id IN (SELECT CAST(${idCol} AS TEXT) FROM ${table} WHERE CAST(${adam} AS TEXT) = (SELECT CAST(track_id AS TEXT) FROM apps WHERE id = @appId))`);
  }
  return `(@appId IS NULL OR ${clauses.join(" OR ")})`;
}

export function getKeywordRoas(q?: AnalyticsQuery): KeywordRoasResult {
  const ctx = context(q);
  const spend = ctx.d
    .prepare(
      `SELECT a.keyword_id AS keywordId, MAX(a.keyword) AS keyword, MAX(a.campaign_id) AS campaignId, MAX(a.currency) AS currency,
              SUM(a.spend) AS spend, SUM(a.impressions) AS impressions, SUM(a.taps) AS taps, SUM(a.installs) AS adsInstalls
       FROM ads_keyword_daily a WHERE a.date BETWEEN @from AND @to AND ${campaignFilter(ctx.d)} GROUP BY a.keyword_id`,
    )
    .all(ctx.params) as { keywordId: string; keyword: string; campaignId: string; currency: string | null; spend: number; impressions: number; taps: number; adsInstalls: number }[];
  const attributed = ctx.d
    .prepare(
      `SELECT i.keyword_id AS keywordId, MAX(i.keyword) AS keyword, MAX(i.campaign_id) AS campaignId, COUNT(DISTINCT i.id) AS installs,
              COUNT(DISTINCT CASE WHEN r.type = 'trial_started' THEN i.id END) AS trials,
              COUNT(DISTINCT CASE WHEN r.amount_usd > 0 THEN i.id END) AS payers,
              COALESCE(SUM(r.amount_usd), 0) AS revenue
       FROM installs i ${cohortRevenueJoin}
       WHERE ${appInstalls} AND i.keyword_id IS NOT NULL AND substr(i.installed_at, 1, 10) BETWEEN @from AND @to
       GROUP BY i.keyword_id`,
    )
    .all(ctx.params) as { keywordId: string; keyword: string | null; campaignId: string | null; installs: number; trials: number; payers: number; revenue: number }[];
  const rows = new Map<string, KeywordRoasRow>();
  const blank = (keywordId: string): KeywordRoasRow => ({
    keywordId,
    keyword: null,
    campaignId: null,
    currency: null,
    spend: 0,
    impressions: 0,
    taps: 0,
    adsInstalls: 0,
    installs: 0,
    trials: 0,
    payers: 0,
    revenue: 0,
    cpi: null,
    trialRate: null,
    roas: null,
  });
  for (const s of spend) rows.set(s.keywordId, { ...blank(s.keywordId), ...s });
  for (const a of attributed) {
    const row = rows.get(a.keywordId) ?? blank(a.keywordId);
    rows.set(a.keywordId, { ...row, keyword: row.keyword ?? a.keyword, campaignId: row.campaignId ?? a.campaignId, installs: a.installs, trials: a.trials, payers: a.payers, revenue: a.revenue });
  }
  const lookup = ctx.d.prepare("SELECT keyword FROM ads_keyword_daily WHERE keyword_id = ? ORDER BY date DESC LIMIT 1");
  const keywords = [...rows.values()]
    .map((r) => {
      const installs = r.installs || r.adsInstalls;
      return {
        ...r,
        keyword: r.keyword ?? (lookup.get(r.keywordId) as { keyword: string } | undefined)?.keyword ?? null,
        cpi: costPer(r.spend, installs),
        trialRate: ratio(r.trials, r.installs),
        roas: ratio(r.revenue, r.spend),
      };
    })
    .sort((a, b) => b.spend - a.spend || b.revenue - a.revenue);
  const total = keywords.reduce(
    (acc, r) => ({ spend: acc.spend + r.spend, installs: acc.installs + r.installs, adsInstalls: acc.adsInstalls + r.adsInstalls, trials: acc.trials + r.trials, revenue: acc.revenue + r.revenue }),
    { spend: 0, installs: 0, adsInstalls: 0, trials: 0, revenue: 0 },
  );
  const currencies = [...new Set(keywords.map((k) => k.currency).filter((c): c is string => !!c))];
  return {
    ...meta(ctx),
    keywords,
    totals: { ...total, cpi: costPer(total.spend, total.installs || total.adsInstalls), trialRate: ratio(total.trials, total.installs), roas: ratio(total.revenue, total.spend) },
    currency: currencies.length === 1 ? currencies[0] : currencies.length ? "MIXED" : "USD",
  };
}

export function getKeywordTrend(keywordId: string, q?: AnalyticsQuery): KeywordTrendResult {
  const ctx = context(q);
  const p = { ...ctx.params, keywordId };
  const spend = new Map(
    (ctx.d.prepare("SELECT a.date AS day, SUM(a.spend) AS spend, SUM(a.taps) AS taps, SUM(a.installs) AS adsInstalls FROM ads_keyword_daily a WHERE a.keyword_id = @keywordId AND a.date BETWEEN @from AND @to GROUP BY a.date").all(p) as {
      day: string;
      spend: number;
      taps: number;
      adsInstalls: number;
    }[]).map((r) => [r.day, r]),
  );
  const installs = new Map(
    (ctx.d.prepare(`SELECT substr(i.installed_at, 1, 10) AS day, COUNT(*) AS n FROM installs i WHERE ${appInstalls} AND i.keyword_id = @keywordId AND substr(i.installed_at, 1, 10) BETWEEN @from AND @to GROUP BY day`).all(p) as { day: string; n: number }[]).map(
      (r) => [r.day, r.n],
    ),
  );
  const revenue = new Map(
    (
      ctx.d
        .prepare(
          `SELECT substr(r.occurred_at, 1, 10) AS day, COALESCE(SUM(r.amount_usd), 0) AS revenue, SUM(r.type = 'trial_started') AS trials
           FROM revenue_events r JOIN installs i ON i.user_id = r.user_id AND (r.app_id IS NULL OR r.app_id = i.app_id)
           WHERE ${validRevenue} AND ${appInstalls} AND i.keyword_id = @keywordId AND substr(r.occurred_at, 1, 10) BETWEEN @from AND @to GROUP BY day`,
        )
        .all(p) as { day: string; revenue: number; trials: number }[]
    ).map((r) => [r.day, r]),
  );
  let cumSpend = 0;
  let cumRevenue = 0;
  const series = dateRange(ctx.params.from, ctx.params.to).map((date) => {
    const s = spend.get(date);
    const r = revenue.get(date);
    cumSpend += s?.spend ?? 0;
    cumRevenue += r?.revenue ?? 0;
    return {
      date,
      spend: s?.spend ?? 0,
      taps: s?.taps ?? 0,
      adsInstalls: s?.adsInstalls ?? 0,
      installs: installs.get(date) ?? 0,
      trials: r?.trials ?? 0,
      revenue: r?.revenue ?? 0,
      cumulativeRoas: ratio(cumRevenue, cumSpend),
    };
  });
  const keyword =
    (ctx.d.prepare("SELECT keyword FROM ads_keyword_daily WHERE keyword_id = ? ORDER BY date DESC LIMIT 1").get(keywordId) as { keyword: string } | undefined)?.keyword ??
    (ctx.d.prepare("SELECT keyword FROM installs WHERE keyword_id = ? AND keyword IS NOT NULL LIMIT 1").get(keywordId) as { keyword: string } | undefined)?.keyword ??
    null;
  return { ...meta(ctx), keywordId, keyword, series };
}
