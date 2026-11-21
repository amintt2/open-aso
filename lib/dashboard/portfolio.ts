import { listApps, type TrackedApp } from "@/lib/aso/apps";
import { listKeywords } from "@/lib/aso/keywords";
import { cached, wsKey } from "@/lib/server/cache";
import { getTraffic, trafficDays } from "@/lib/traffic/service";
import { dailySearchInstalls } from "@/lib/trends/compute";
import { getTrends } from "@/lib/trends/service";
import type { TrafficResult, TrafficStepKey } from "@/lib/traffic/types";
import { demoPortfolio } from "./portfolio-demo";
import { splitCountries, sumSteps } from "./portfolio-math";
import { PORTFOLIO_METRICS, type PortfolioApp, type PortfolioCountry, type PortfolioKeyword, type PortfolioMetric, type PortfolioResult, type PortfolioValue } from "./portfolio-types";

export type * from "./portfolio-types";

const TTL = 5 * 60 * 1000;
const KEYWORD_LIMIT = 12;
const DAY = 86400000;

function range(from: string, to: string) {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += DAY) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

const ratio = (a: number | null, b: number | null) => (a != null && b ? a / b : null);

function appFrom(app: TrackedApp, t: TrafficResult, dates: string[]): PortfolioApp {
  const byDate = new Map(t.daily.map((p) => [p.date, p]));
  const steps = Object.fromEntries(t.steps.map((s) => [s.key, { value: s.value, previous: s.previous }])) as Record<TrafficStepKey, PortfolioValue>;
  const series = Object.fromEntries(PORTFOLIO_METRICS.map((m) => [m, dates.map((d) => byDate.get(d)?.[m] ?? null)])) as Record<PortfolioMetric, (number | null)[]>;
  return {
    key: String(app.id),
    id: app.id,
    name: app.name,
    iconUrl: app.iconUrl,
    sources: { apple: t.sources.apple.state, posthog: t.sources.posthog.state, revenue: t.sources.revenue.state },
    steps,
    series,
    conversion: { value: ratio(steps.downloads.value, steps.impressions.value), previous: ratio(steps.downloads.previous, steps.impressions.previous) },
    keywords: t.rankings.keywords,
    top10: t.rankings.top10,
    estPerDay: t.rankings.estPerDay,
    reach: t.rankings.reach,
    versions: t.versions,
  };
}

async function topKeywords(workspaceId: string, app: TrackedApp): Promise<PortfolioKeyword[]> {
  const [list, trends] = await Promise.all([listKeywords(workspaceId, app.id), getTrends(workspaceId, app.id, { country: "all", days: 30 }).catch(() => null)]);
  const factor = trends?.calibration?.factor ?? 1;
  return list
    .filter((k) => k.position != null && k.relevanceCategory !== "unrelated" && k.relevanceCategory !== "brand")
    .map((k) => ({ id: app.id, app: app.name, term: k.term, country: k.country, position: k.position, popularity: k.popularity, estInstalls: Math.round(dailySearchInstalls(k.popularity, k.country, k.position) * factor * 100) / 100 }))
    .sort((a, b) => b.estInstalls - a.estInstalls || (a.position ?? 999) - (b.position ?? 999))
    .slice(0, KEYWORD_LIMIT);
}

async function load(workspaceId: string, days: number): Promise<PortfolioResult> {
  const all = await listApps(workspaceId);
  const own = all.filter((a) => a.isMine);
  const scope = own.length ? own : all;
  const loaded = await Promise.all(
    scope.map(async (app) => ({
      app,
      traffic: await getTraffic(workspaceId, app.id, { days, country: "all" }).catch(() => null),
      keywords: app.keywordCount ? await topKeywords(workspaceId, app).catch(() => []) : [],
    })),
  );
  const ready = loaded.filter((x): x is typeof x & { traffic: TrafficResult } => !!x.traffic);
  const to = new Date().toISOString().slice(0, 10);
  const from = ready.reduce((min, x) => (x.traffic.from < min ? x.traffic.from : min), new Date(Date.now() - (days - 1) * DAY).toISOString().slice(0, 10));
  const dates = range(from, to);
  const apps = ready.map((x) => appFrom(x.app, x.traffic, dates)).sort((a, b) => (b.steps.downloads.value ?? -1) - (a.steps.downloads.value ?? -1) || (b.estPerDay ?? 0) - (a.estPerDay ?? 0));
  const order = new Map(apps.map((a, i) => [a.id, i]));
  const byCountry = new Map<string, PortfolioCountry>();
  for (const x of ready) {
    const i = order.get(x.app.id) ?? 0;
    for (const c of x.traffic.countries) {
      if (!c.downloads) continue;
      const row = byCountry.get(c.country) ?? { country: c.country, total: 0, byApp: apps.map(() => 0) };
      row.byApp[i] += c.downloads;
      row.total += c.downloads;
      byCountry.set(c.country, row);
    }
  }
  const keywords: PortfolioKeyword[] = loaded
    .flatMap((x) => x.keywords)
    .sort((a, b) => b.estInstalls - a.estInstalls || (a.position ?? 999) - (b.position ?? 999))
    .slice(0, KEYWORD_LIMIT);
  const through = ready.map((x) => x.traffic.sources.apple.through).filter((d): d is string => !!d && isDay(d));
  return {
    days: trafficDays(days),
    demo: false,
    from,
    to,
    dates,
    appleThrough: through.length ? through.reduce((m, d) => (d > m ? d : m)) : null,
    revenueProviders: [...new Set(ready.flatMap((x) => x.traffic.revenueProviders))],
    apps,
    steps: sumSteps(apps),
    ...splitCountries([...byCountry.values()]),
    keywords,
  };
}

function isDay(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

export function getPortfolio(workspaceId: string, q: { days?: number; demo?: boolean } = {}): Promise<PortfolioResult> {
  const days = trafficDays(q.days);
  if (q.demo) return Promise.resolve(demoPortfolio(days));
  return cached(wsKey(workspaceId, `dashboard:portfolio:${days}`), TTL, () => load(workspaceId, days));
}
