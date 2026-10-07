import { getApp } from "@/lib/aso/apps";
import { demoDb, DEMO_NOTICE, DEMO_WORKSPACE } from "./demo";
import { pgRunner, sqliteRunner, type Runner } from "./sql";
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

const PURCHASE_TYPES =
  "('initial_purchase','trial_converted','non_renewing_purchase')";
const DAY_MS = 86400000;

type Params = {
  ws: string;
  appId: number | null;
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  sandbox: number;
  today: string;
};

type Ctx = { run: Runner; demo: boolean; days: number; params: Params };

const APP_ID = "CAST(@appId AS bigint)";
const validRevenue = `r.workspace_id = @ws AND r.type NOT IN ('test','other') AND (${APP_ID} IS NULL OR r.app_id = ${APP_ID}) AND (@sandbox = 1 OR COALESCE(r.raw ->> 'environment', '') != 'SANDBOX')`;
const appInstalls = `i.workspace_id = @ws AND (${APP_ID} IS NULL OR i.app_id = ${APP_ID})`;
const installDay = "analytics_day(i.installed_at)";
const revenueDay = "analytics_day(r.occurred_at)";
const cohortRevenueJoin = `LEFT JOIN revenue_events r ON r.workspace_id = i.workspace_id AND r.user_id = i.user_id AND (r.app_id IS NULL OR r.app_id = i.app_id) AND ${validRevenue}`;
const sum = (condition: string) =>
  `COALESCE(SUM(CASE WHEN ${condition} THEN 1 ELSE 0 END), 0)`;

function isoDay(t: number) {
  return new Date(t).toISOString().slice(0, 10);
}

export function periodDays(value: unknown) {
  const n = Number(value);
  return [7, 30, 90].includes(n) ? n : 30;
}

async function hasRealData(workspaceId: string, appId: number | null) {
  const row = await pgRunner.get<{ installs: boolean; revenue: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM installs i WHERE ${appInstalls}) AS installs,
            EXISTS(SELECT 1 FROM revenue_events r WHERE r.workspace_id = @ws AND r.type NOT IN ('test','other') AND (${APP_ID} IS NULL OR r.app_id = ${APP_ID})) AS revenue`,
    { ws: workspaceId, appId },
  );
  return !!(row?.installs || row?.revenue);
}

async function context(
  workspaceId: string,
  q: AnalyticsQuery = {},
): Promise<Ctx> {
  const days = periodDays(q.days ?? 30);
  const mode = q.demo ?? "never";
  const appId = q.appId ?? null;
  if (appId && mode !== "only") await getApp(workspaceId, appId);
  const demo =
    mode === "only" ||
    (mode === "auto" && !(await hasRealData(workspaceId, appId)));
  const now = Date.now();
  const to = isoDay(now);
  return {
    run: demo ? sqliteRunner(demoDb()) : pgRunner,
    demo,
    days,
    params: {
      ws: demo ? DEMO_WORKSPACE : workspaceId,
      appId: demo ? null : appId,
      from: isoDay(now - (days - 1) * DAY_MS),
      to,
      prevFrom: isoDay(now - (2 * days - 1) * DAY_MS),
      prevTo: isoDay(now - days * DAY_MS),
      sandbox: q.includeSandbox ? 1 : 0,
      today: to,
    },
  };
}

function meta(ctx: Ctx) {
  return {
    demo: ctx.demo,
    notice: ctx.demo ? DEMO_NOTICE : null,
    from: ctx.params.from,
    to: ctx.params.to,
    days: ctx.days,
  };
}

function dateRange(from: string, to: string) {
  const out: string[] = [];
  for (
    let t = Date.parse(`${from}T00:00:00Z`);
    t <= Date.parse(`${to}T00:00:00Z`);
    t += DAY_MS
  )
    out.push(isoDay(t));
  return out;
}

function ratio(a: number, b: number) {
  return b > 0 ? a / b : null;
}

function costPer(spend: number, count: number) {
  return spend > 0 && count > 0 ? spend / count : null;
}

async function totalsFor(
  ctx: Ctx,
  from: string,
  to: string,
): Promise<OverviewTotals> {
  const p = { ...ctx.params, from, to };
  const [installs, r] = await Promise.all([
    ctx.run.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM installs i WHERE ${appInstalls} AND ${installDay} BETWEEN @from AND @to`,
      p,
    ),
    ctx.run.get<{
      trials: number;
      purchases: number;
      conversions: number;
      gross: number;
      refunds: number;
      payers: number;
    }>(
      `SELECT ${sum("r.type = 'trial_started'")} AS trials,
              ${sum(`r.type IN ${PURCHASE_TYPES}`)} AS purchases,
              ${sum("r.type = 'trial_converted'")} AS conversions,
              COALESCE(SUM(CASE WHEN r.amount_usd > 0 THEN r.amount_usd ELSE 0 END), 0) AS gross,
              COALESCE(SUM(CASE WHEN r.amount_usd < 0 THEN -r.amount_usd ELSE 0 END), 0) AS refunds,
              COUNT(DISTINCT CASE WHEN r.amount_usd > 0 THEN r.user_id END) AS payers
       FROM revenue_events r WHERE ${validRevenue} AND ${revenueDay} BETWEEN @from AND @to`,
      p,
    ),
  ]);
  const t = r ?? {
    trials: 0,
    purchases: 0,
    conversions: 0,
    gross: 0,
    refunds: 0,
    payers: 0,
  };
  return {
    installs: installs?.n ?? 0,
    trials: t.trials,
    purchases: t.purchases,
    grossRevenue: t.gross,
    refunds: t.refunds,
    netRevenue: t.gross - t.refunds,
    payingUsers: t.payers,
    trialConversion: ratio(t.conversions, t.trials),
  };
}

export async function getOverview(
  workspaceId: string,
  q?: AnalyticsQuery,
): Promise<OverviewResult> {
  const ctx = await context(workspaceId, q);
  const { from, to } = ctx.params;
  const [installRows, revenueRows, totals, previous] = await Promise.all([
    ctx.run.all<{ day: string; n: number }>(
      `SELECT ${installDay} AS day, COUNT(*) AS n FROM installs i WHERE ${appInstalls} AND ${installDay} BETWEEN @from AND @to GROUP BY 1`,
      ctx.params,
    ),
    ctx.run.all<{
      day: string;
      trials: number;
      purchases: number;
      gross: number;
      refunds: number;
    }>(
      `SELECT ${revenueDay} AS day, ${sum("r.type = 'trial_started'")} AS trials, ${sum(`r.type IN ${PURCHASE_TYPES}`)} AS purchases,
              COALESCE(SUM(CASE WHEN r.amount_usd > 0 THEN r.amount_usd ELSE 0 END), 0) AS gross, COALESCE(SUM(CASE WHEN r.amount_usd < 0 THEN -r.amount_usd ELSE 0 END), 0) AS refunds
       FROM revenue_events r WHERE ${validRevenue} AND ${revenueDay} BETWEEN @from AND @to GROUP BY 1`,
      ctx.params,
    ),
    totalsFor(ctx, from, to),
    totalsFor(ctx, ctx.params.prevFrom, ctx.params.prevTo),
  ]);
  const installs = new Map(installRows.map((r) => [r.day, r.n]));
  const revenue = new Map(revenueRows.map((r) => [r.day, r]));
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
  return { ...meta(ctx), totals, previous, series };
}

export async function getSources(
  workspaceId: string,
  q?: AnalyticsQuery,
): Promise<SourcesResult> {
  const ctx = await context(workspaceId, q);
  const [rows, unattributed, dailyRows, campaigns] = await Promise.all([
    ctx.run.all<{
      source: string;
      installs: number;
      trials: number;
      payers: number;
      revenue: number;
    }>(
      `SELECT i.source AS source, COUNT(DISTINCT i.id) AS installs,
              COUNT(DISTINCT CASE WHEN r.type = 'trial_started' THEN i.id END) AS trials,
              COUNT(DISTINCT CASE WHEN r.amount_usd > 0 THEN i.id END) AS payers,
              COALESCE(SUM(r.amount_usd), 0) AS revenue
       FROM installs i ${cohortRevenueJoin}
       WHERE ${appInstalls} AND ${installDay} BETWEEN @from AND @to
       GROUP BY i.source`,
      ctx.params,
    ),
    ctx.run.get<{ revenue: number }>(
      `SELECT COALESCE(SUM(r.amount_usd), 0) AS revenue FROM revenue_events r
       WHERE ${validRevenue} AND ${revenueDay} BETWEEN @from AND @to
         AND NOT EXISTS (SELECT 1 FROM installs i WHERE i.workspace_id = @ws AND i.user_id = r.user_id)`,
      ctx.params,
    ),
    ctx.run.all<{ day: string; source: string; n: number }>(
      `SELECT ${installDay} AS day, i.source AS source, COUNT(*) AS n FROM installs i WHERE ${appInstalls} AND ${installDay} BETWEEN @from AND @to GROUP BY 1, 2`,
      ctx.params,
    ),
    ctx.run.all<{
      campaignId: string;
      installs: number;
      trials: number;
      revenue: number;
      spend: number;
    }>(
      `SELECT i.campaign_id AS "campaignId", COUNT(DISTINCT i.id) AS installs,
              COUNT(DISTINCT CASE WHEN r.type = 'trial_started' THEN i.id END) AS trials,
              COALESCE(SUM(r.amount_usd), 0) AS revenue,
              (SELECT COALESCE(SUM(a.spend), 0) FROM ads_keyword_daily a WHERE a.workspace_id = @ws AND a.campaign_id = i.campaign_id AND a.date BETWEEN @from AND @to) AS spend
       FROM installs i ${cohortRevenueJoin}
       WHERE ${appInstalls} AND i.source = 'apple_ads' AND i.campaign_id IS NOT NULL AND ${installDay} BETWEEN @from AND @to
       GROUP BY i.campaign_id ORDER BY installs DESC LIMIT 20`,
      ctx.params,
    ),
  ]);
  const sources: SourceRow[] = (["apple_ads", "organic"] as const).map(
    (source) => {
      const r = rows.find((x) => x.source === source) ?? {
        installs: 0,
        trials: 0,
        payers: 0,
        revenue: 0,
      };
      return {
        source,
        installs: r.installs,
        trials: r.trials,
        payers: r.payers,
        revenue: r.revenue,
        trialRate: ratio(r.trials, r.installs),
        conversion: ratio(r.payers, r.installs),
        revenuePerInstall: ratio(r.revenue, r.installs),
      };
    },
  );
  const daily = new Map<
    string,
    { date: string; apple_ads: number; organic: number }
  >(
    dateRange(ctx.params.from, ctx.params.to).map((date) => [
      date,
      { date, apple_ads: 0, organic: 0 },
    ]),
  );
  for (const r of dailyRows) {
    const entry = daily.get(r.day);
    if (entry && (r.source === "apple_ads" || r.source === "organic"))
      entry[r.source] += r.n;
  }
  return {
    ...meta(ctx),
    sources,
    unattributedRevenue: unattributed?.revenue ?? 0,
    daily: [...daily.values()],
    campaigns: campaigns.map((c) => ({
      ...c,
      roas: ratio(c.revenue, c.spend),
    })),
  };
}

export async function getGeography(
  workspaceId: string,
  q?: AnalyticsQuery,
): Promise<GeographyResult> {
  const ctx = await context(workspaceId, q);
  const [installs, revenue, cities] = await Promise.all([
    ctx.run.all<{ country: string; installs: number }>(
      `SELECT COALESCE(i.country, '??') AS country, COUNT(*) AS installs FROM installs i WHERE ${appInstalls} AND ${installDay} BETWEEN @from AND @to GROUP BY 1`,
      ctx.params,
    ),
    ctx.run.all<{
      country: string;
      revenue: number;
      trials: number;
      payers: number;
    }>(
      `SELECT x.country AS country, COALESCE(SUM(x.amount_usd), 0) AS revenue, ${sum("x.type = 'trial_started'")} AS trials,
              COUNT(DISTINCT CASE WHEN x.amount_usd > 0 THEN x.user_id END) AS payers
       FROM (
         SELECT COALESCE(r.country, (SELECT i.country FROM installs i WHERE i.workspace_id = @ws AND i.user_id = r.user_id LIMIT 1), '??') AS country,
                r.amount_usd, r.type, r.user_id
         FROM revenue_events r WHERE ${validRevenue} AND ${revenueDay} BETWEEN @from AND @to
       ) x GROUP BY x.country`,
      ctx.params,
    ),
    ctx.run.all<CityRow>(
      `SELECT i.city AS city, i.country AS country, COUNT(DISTINCT i.id) AS installs, COALESCE(SUM(r.amount_usd), 0) AS revenue
       FROM installs i ${cohortRevenueJoin}
       WHERE ${appInstalls} AND i.city IS NOT NULL AND i.city != '' AND ${installDay} BETWEEN @from AND @to
       GROUP BY i.city, i.country ORDER BY installs DESC LIMIT 25`,
      ctx.params,
    ),
  ]);
  const map = new Map<string, CountryRow>();
  const entry = (country: string) => {
    const existing = map.get(country);
    if (existing) return existing;
    const row: CountryRow = {
      country,
      installs: 0,
      trials: 0,
      payers: 0,
      revenue: 0,
      revenuePerInstall: null,
    };
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
  const countries = [...map.values()]
    .map((r) => ({ ...r, revenuePerInstall: ratio(r.revenue, r.installs) }))
    .sort((a, b) => b.installs - a.installs || b.revenue - a.revenue);
  return { ...meta(ctx), countries, cities };
}

export async function getRetention(
  workspaceId: string,
  q?: AnalyticsQuery,
): Promise<RetentionResult> {
  const ctx = await context(workspaceId, q);
  const weekly = ctx.days > 7;
  const cohortExpr = weekly ? `analytics_week(${installDay})` : installDay;
  const retained = (n: number) => {
    const target = `analytics_add_days(${installDay}, ${n})`;
    return `${sum(`${target} <= @today`)} AS e${n},
     ${sum(`${target} <= @today AND EXISTS (SELECT 1 FROM analytics_sessions s WHERE s.workspace_id = @ws AND s.app_id = i.app_id AND s.user_id = i.user_id AND s.date = ${target})`)} AS r${n}`;
  };
  const [rows, sessions] = await Promise.all([
    ctx.run.all<{
      cohort: string;
      installs: number;
      e1: number;
      r1: number;
      e7: number;
      r7: number;
      e30: number;
      r30: number;
    }>(
      `SELECT ${cohortExpr} AS cohort, COUNT(*) AS installs, ${retained(1)}, ${retained(7)}, ${retained(30)}
       FROM installs i WHERE ${appInstalls} AND ${installDay} BETWEEN @from AND @to
       GROUP BY 1 ORDER BY 1 DESC`,
      ctx.params,
    ),
    ctx.run.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM analytics_sessions s WHERE s.workspace_id = @ws AND (${APP_ID} IS NULL OR s.app_id = ${APP_ID}) AND s.date BETWEEN @from AND @to`,
      ctx.params,
    ),
  ]);
  const cohorts: RetentionCohort[] = rows.map((r) => ({
    cohort: r.cohort,
    installs: r.installs,
    d1: ratio(r.r1, r.e1),
    d7: ratio(r.r7, r.e7),
    d30: ratio(r.r30, r.e30),
    eligible: { d1: r.e1, d7: r.e7, d30: r.e30 },
  }));
  const total = (k: "r1" | "e1" | "r7" | "e7" | "r30" | "e30") =>
    rows.reduce((acc, r) => acc + r[k], 0);
  return {
    ...meta(ctx),
    granularity: weekly ? "week" : "day",
    cohorts,
    average: {
      d1: ratio(total("r1"), total("e1")),
      d7: ratio(total("r7"), total("e7")),
      d30: ratio(total("r30"), total("e30")),
    },
    sessionDays: sessions?.n ?? 0,
  };
}

const campaignFilter = `(${APP_ID} IS NULL
  OR a.campaign_id IN (SELECT DISTINCT x.campaign_id FROM installs x WHERE x.workspace_id = @ws AND x.app_id = ${APP_ID} AND x.campaign_id IS NOT NULL)
  OR a.campaign_id IN (SELECT c.campaign_id FROM ads_campaigns c JOIN apps p ON p.workspace_id = c.workspace_id AND p.track_id = c.adam_id WHERE c.workspace_id = @ws AND p.id = ${APP_ID}))`;

async function keywordName(ctx: Ctx, keywordId: string) {
  const p = { ws: ctx.params.ws, keywordId };
  return (
    (
      await ctx.run.get<{ keyword: string }>(
        "SELECT keyword FROM ads_keyword_daily WHERE workspace_id = @ws AND keyword_id = @keywordId ORDER BY date DESC LIMIT 1",
        p,
      )
    )?.keyword ??
    (
      await ctx.run.get<{ keyword: string }>(
        "SELECT keyword FROM installs WHERE workspace_id = @ws AND keyword_id = @keywordId AND keyword IS NOT NULL LIMIT 1",
        p,
      )
    )?.keyword ??
    null
  );
}

export async function getKeywordRoas(
  workspaceId: string,
  q?: AnalyticsQuery,
): Promise<KeywordRoasResult> {
  const ctx = await context(workspaceId, q);
  const [spend, attributed] = await Promise.all([
    ctx.run.all<{
      keywordId: string;
      keyword: string;
      campaignId: string;
      currency: string | null;
      spend: number;
      impressions: number;
      taps: number;
      adsInstalls: number;
    }>(
      `SELECT a.keyword_id AS "keywordId", MAX(a.keyword) AS keyword, MAX(a.campaign_id) AS "campaignId", MAX(a.currency) AS currency,
              COALESCE(SUM(a.spend), 0) AS spend, COALESCE(SUM(a.impressions), 0) AS impressions, COALESCE(SUM(a.taps), 0) AS taps, COALESCE(SUM(a.installs), 0) AS "adsInstalls"
       FROM ads_keyword_daily a WHERE a.workspace_id = @ws AND a.date BETWEEN @from AND @to AND ${campaignFilter} GROUP BY a.keyword_id`,
      ctx.params,
    ),
    ctx.run.all<{
      keywordId: string;
      keyword: string | null;
      campaignId: string | null;
      installs: number;
      trials: number;
      payers: number;
      revenue: number;
    }>(
      `SELECT i.keyword_id AS "keywordId", MAX(i.keyword) AS keyword, MAX(i.campaign_id) AS "campaignId", COUNT(DISTINCT i.id) AS installs,
              COUNT(DISTINCT CASE WHEN r.type = 'trial_started' THEN i.id END) AS trials,
              COUNT(DISTINCT CASE WHEN r.amount_usd > 0 THEN i.id END) AS payers,
              COALESCE(SUM(r.amount_usd), 0) AS revenue
       FROM installs i ${cohortRevenueJoin}
       WHERE ${appInstalls} AND i.keyword_id IS NOT NULL AND ${installDay} BETWEEN @from AND @to
       GROUP BY i.keyword_id`,
      ctx.params,
    ),
  ]);
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
    rows.set(a.keywordId, {
      ...row,
      keyword: row.keyword ?? a.keyword,
      campaignId: row.campaignId ?? a.campaignId,
      installs: a.installs,
      trials: a.trials,
      payers: a.payers,
      revenue: a.revenue,
    });
  }
  const keywords = (
    await Promise.all(
      [...rows.values()].map(async (r) => {
        const installs = r.installs || r.adsInstalls;
        return {
          ...r,
          keyword: r.keyword ?? (await keywordName(ctx, r.keywordId)),
          cpi: costPer(r.spend, installs),
          trialRate: ratio(r.trials, r.installs),
          roas: ratio(r.revenue, r.spend),
        };
      }),
    )
  ).sort((a, b) => b.spend - a.spend || b.revenue - a.revenue);
  const total = keywords.reduce(
    (acc, r) => ({
      spend: acc.spend + r.spend,
      installs: acc.installs + r.installs,
      adsInstalls: acc.adsInstalls + r.adsInstalls,
      trials: acc.trials + r.trials,
      revenue: acc.revenue + r.revenue,
    }),
    { spend: 0, installs: 0, adsInstalls: 0, trials: 0, revenue: 0 },
  );
  const currencies = [
    ...new Set(keywords.map((k) => k.currency).filter((c): c is string => !!c)),
  ];
  return {
    ...meta(ctx),
    keywords,
    totals: {
      ...total,
      cpi: costPer(total.spend, total.installs || total.adsInstalls),
      trialRate: ratio(total.trials, total.installs),
      roas: ratio(total.revenue, total.spend),
    },
    currency:
      currencies.length === 1
        ? currencies[0]
        : currencies.length
          ? "MIXED"
          : "USD",
  };
}

export async function getKeywordTrend(
  workspaceId: string,
  keywordId: string,
  q?: AnalyticsQuery,
): Promise<KeywordTrendResult> {
  const ctx = await context(workspaceId, q);
  const p = { ...ctx.params, keywordId };
  const [spendRows, installRows, revenueRows, keyword] = await Promise.all([
    ctx.run.all<{
      day: string;
      spend: number;
      taps: number;
      adsInstalls: number;
    }>(
      `SELECT a.date AS day, COALESCE(SUM(a.spend), 0) AS spend, COALESCE(SUM(a.taps), 0) AS taps, COALESCE(SUM(a.installs), 0) AS "adsInstalls"
       FROM ads_keyword_daily a WHERE a.workspace_id = @ws AND a.keyword_id = @keywordId AND a.date BETWEEN @from AND @to GROUP BY a.date`,
      p,
    ),
    ctx.run.all<{ day: string; n: number }>(
      `SELECT ${installDay} AS day, COUNT(*) AS n FROM installs i WHERE ${appInstalls} AND i.keyword_id = @keywordId AND ${installDay} BETWEEN @from AND @to GROUP BY 1`,
      p,
    ),
    ctx.run.all<{ day: string; revenue: number; trials: number }>(
      `SELECT ${revenueDay} AS day, COALESCE(SUM(r.amount_usd), 0) AS revenue, ${sum("r.type = 'trial_started'")} AS trials
       FROM revenue_events r JOIN installs i ON i.workspace_id = r.workspace_id AND i.user_id = r.user_id AND (r.app_id IS NULL OR r.app_id = i.app_id)
       WHERE ${validRevenue} AND ${appInstalls} AND i.keyword_id = @keywordId AND ${revenueDay} BETWEEN @from AND @to GROUP BY 1`,
      p,
    ),
    keywordName(ctx, keywordId),
  ]);
  const spend = new Map(spendRows.map((r) => [r.day, r]));
  const installs = new Map(installRows.map((r) => [r.day, r.n]));
  const revenue = new Map(revenueRows.map((r) => [r.day, r]));
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
  return { ...meta(ctx), keywordId, keyword, series };
}
