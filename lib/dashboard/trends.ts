import { listApps, type TrackedApp } from "@/lib/aso/apps";
import {
  aggregateDay,
  computeMovers,
  dailySearchInstalls,
} from "@/lib/trends/compute";
import { getTrends } from "@/lib/trends/service";
import type {
  TrendKeyword,
  TrendPoint,
  TrendsResult,
} from "@/lib/trends/types";
import type { AppRef, DashboardMover, Period } from "./types";

export type AppTrends = { app: TrackedApp; trends: TrendsResult | null };

export const WINDOW_DAYS = 30;
export const COMPARE_DAYS = 7;

export function appRef(
  app: Pick<TrackedApp, "id" | "name" | "iconUrl">,
): AppRef {
  return { appId: app.id, appName: app.name, iconUrl: app.iconUrl };
}

export async function appTrends(
  workspaceId: string,
  app: TrackedApp,
  country = "all",
): Promise<TrendsResult | null> {
  if (!app.keywordCount) return null;
  return getTrends(workspaceId, app.id, { country, days: WINDOW_DAYS }).catch(
    (error) => {
      console.error(error);
      return null;
    },
  );
}

export async function workspaceTrends(
  workspaceId: string,
): Promise<AppTrends[]> {
  const apps = await listApps(workspaceId);
  return Promise.all(
    apps.map(async (app) => ({
      app,
      trends: await appTrends(workspaceId, app),
    })),
  );
}

export function combinedPoints(list: AppTrends[]): TrendPoint[] {
  const ready = list.filter(
    (x): x is AppTrends & { trends: TrendsResult } => !!x.trends,
  );
  if (!ready.length) return [];
  const dates = ready[0].trends.dates;
  const keywords = ready
    .filter((x) => x.trends.to === ready[0].trends.to)
    .flatMap((x) => x.trends.keywords);
  return dates.map((date, i) => aggregateDay(keywords, i, date));
}

export function compareIndex(points: TrendPoint[], days = COMPARE_DAYS) {
  const end = points.length - 1;
  const first = points.findIndex((p) => p.tracked > 0);
  if (end < 0 || first < 0) return null;
  return { end, previous: end - days >= first ? end - days : null, first };
}

export function periodOf(
  points: TrendPoint[],
  pick: (p: TrendPoint) => number | null,
  days = COMPARE_DAYS,
): Period | null {
  const idx = compareIndex(points, days);
  if (!idx) return null;
  const current = pick(points[idx.end]);
  if (current == null) return null;
  return {
    current,
    previous: idx.previous == null ? null : pick(points[idx.previous]),
  };
}

export function averagePeriod(
  points: TrendPoint[],
  pick: (p: TrendPoint) => number,
  days = COMPARE_DAYS,
): Period | null {
  const tracked = points.filter((p) => p.tracked > 0);
  if (!tracked.length) return null;
  const last = tracked.slice(-days);
  const prior = tracked.slice(-2 * days, -days);
  const avg = (list: TrendPoint[]) =>
    list.reduce((s, p) => s + pick(p), 0) / list.length;
  return {
    current: Math.round(avg(last) * 10) / 10,
    previous: prior.length ? Math.round(avg(prior) * 10) / 10 : null,
  };
}

export function bestKeyword(keywords: TrendKeyword[], end: number) {
  let best: {
    term: string;
    country: string;
    position: number | null;
    installs: number;
  } | null = null;
  for (const k of keywords) {
    const position = k.position[end];
    const installs = dailySearchInstalls(
      k.popularity[end],
      k.country,
      position,
    );
    if (
      !best ||
      installs > best.installs ||
      (installs === best.installs &&
        position != null &&
        (best.position == null || position < best.position))
    )
      best = {
        term: k.term,
        country: k.country,
        position,
        installs: Math.round(installs * 10) / 10,
      };
  }
  return best;
}

export function moversAcross(
  list: AppTrends[],
  days = COMPARE_DAYS,
  limit = 8,
) {
  const owners = new Map<number, AppRef>();
  const keywords: TrendKeyword[] = [];
  let dates: string[] = [];
  for (const { app, trends } of list) {
    if (!trends) continue;
    if (!dates.length) dates = trends.dates;
    if (trends.dates[trends.dates.length - 1] !== dates[dates.length - 1])
      continue;
    for (const k of trends.keywords) {
      owners.set(k.id, appRef(app));
      keywords.push(k);
    }
  }
  const end = dates.length - 1;
  const first = keywords.reduce<number | null>(
    (min, k) =>
      k.since == null ? min : min == null ? k.since : Math.min(min, k.since),
    null,
  );
  if (end < 1 || first == null)
    return { gainers: [] as DashboardMover[], losers: [] as DashboardMover[] };
  const baseline = Math.max(first, end - days);
  const movers = computeMovers(keywords, baseline, end);
  const attach = (rows: typeof movers.gainers) =>
    rows.slice(0, limit).flatMap((m) => {
      const owner = owners.get(m.id);
      return owner ? [{ ...m, ...owner }] : [];
    });
  return { gainers: attach(movers.gainers), losers: attach(movers.losers) };
}
