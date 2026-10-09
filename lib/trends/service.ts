import { getApp, listVersions } from "@/lib/aso/apps";
import type { RelevanceCategory } from "@/lib/relevance/types";
import { cached, wsKey } from "@/lib/server/cache";
import { db } from "@/lib/server/db";
import { aggregateDay, computeCountries, computeMovers, fillSeries, kpisOf, windowDates, type KeywordMeta, type SnapshotRow } from "./compute";
import { EXCLUDED_CATEGORIES, type TrendDays, type TrendsResult } from "./types";

export type TrendsOptions = {
  country: string;
  days: TrendDays;
  keywordIds?: number[];
  includeAll?: boolean;
};

type KeywordRow = {
  id: number;
  term: string;
  country: string;
  popularity_source: string | null;
  relevance_category: string | null;
};

const TTL = 60 * 1000;
const SNAPSHOT_FROM = `FROM keyword_snapshots s JOIN keywords k ON k.id = s.keyword_id JOIN apps a ON a.id = k.app_id`;

export async function getTrends(workspaceId: string, appId: number, options: TrendsOptions): Promise<TrendsResult> {
  const app = await getApp(workspaceId, appId);
  const country = options.country.toLowerCase();
  const ids = options.keywordIds?.length ? [...new Set(options.keywordIds)].sort((a, b) => a - b) : null;
  const includeAll = !!options.includeAll;
  const key = wsKey(workspaceId, `trends:${appId}:${country}:${options.days}:${includeAll ? 1 : 0}:${ids?.join(",") ?? ""}`);
  return cached(key, TTL, () => loadTrends(workspaceId, app.id, app.trackId, { country, days: options.days, ids, includeAll }));
}

async function loadTrends(
  workspaceId: string,
  appId: number,
  trackId: number,
  { country, days, ids, includeAll }: { country: string; days: TrendDays; ids: number[] | null; includeAll: boolean },
): Promise<TrendsResult> {
  const today = (await db.get<{ today: string }>("SELECT current_date AS today"))?.today ?? new Date().toISOString().slice(0, 10);
  const dates = windowDates(today, days);
  const from = dates[0];
  const where = ["a.workspace_id = ?", "k.app_id = ?"];
  const params: unknown[] = [workspaceId, appId];
  if (country !== "all") {
    where.push("k.country = ?");
    params.push(country);
  }
  if (ids) {
    where.push("k.id = ANY(?::bigint[])");
    params.push(ids);
  }
  const rows = await db.all<KeywordRow>(
    `SELECT k.id, k.term, k.country, k.popularity_source, k.relevance_category FROM keywords k JOIN apps a ON a.id = k.app_id
     WHERE ${where.join(" AND ")} ORDER BY k.term ASC, k.country ASC`,
    params,
  );
  const kept = includeAll ? rows : rows.filter((r) => !EXCLUDED_CATEGORIES.includes(r.relevance_category as RelevanceCategory));
  const keptIds = kept.map((r) => r.id);
  const [inWindow, carryIn, versions] = await Promise.all([
    keptIds.length
      ? db.all<SnapshotRow>(
          `SELECT s.keyword_id AS id, s.date, s.popularity, s.difficulty, s.position ${SNAPSHOT_FROM}
           WHERE a.workspace_id = ? AND s.keyword_id = ANY(?::bigint[]) AND s.date >= ?::date AND s.date <= ?::date`,
          [workspaceId, keptIds, from, today],
        )
      : Promise.resolve([]),
    keptIds.length
      ? db.all<SnapshotRow>(
          `SELECT DISTINCT ON (s.keyword_id) s.keyword_id AS id, s.date, s.popularity, s.difficulty, s.position ${SNAPSHOT_FROM}
           WHERE a.workspace_id = ? AND s.keyword_id = ANY(?::bigint[]) AND s.date < ?::date ORDER BY s.keyword_id, s.date DESC`,
          [workspaceId, keptIds, from],
        )
      : Promise.resolve([]),
    listVersions(trackId),
  ]);

  const byKeyword = new Map<number, SnapshotRow[]>();
  for (const row of [...carryIn, ...inWindow]) byKeyword.set(row.id, [...(byKeyword.get(row.id) ?? []), row]);

  const keywords = kept.map((r) => {
    const meta: KeywordMeta = {
      id: r.id,
      term: r.term,
      country: r.country,
      popularitySource: (r.popularity_source as "apple" | "estimate" | null) ?? null,
      relevanceCategory: (r.relevance_category as RelevanceCategory | null) ?? null,
    };
    return fillSeries(meta, dates, byKeyword.get(r.id) ?? []);
  });

  const points = dates.map((date, i) => aggregateDay(keywords, i, date));
  const firstTracked = points.findIndex((p) => p.tracked > 0);
  const baselineIndex = firstTracked >= 0 ? firstTracked : null;
  const end = dates.length - 1;
  const historyDays = new Set(inWindow.map((r) => r.date)).size + (carryIn.length ? 1 : 0);

  return {
    appId,
    country,
    days,
    from,
    to: today,
    dates,
    includeAll,
    excluded: rows.length - kept.length,
    historyDays,
    baselineIndex,
    points,
    kpis: { start: baselineIndex == null ? null : kpisOf(points[baselineIndex]), end: kpisOf(points[end]) },
    countries: computeCountries(keywords, dates, baselineIndex),
    keywords,
    movers: computeMovers(keywords, baselineIndex, end),
    versions: versions
      .map((v) => ({ version: v.version, releasedAt: v.releasedAt, date: v.releasedAt.slice(0, 10) }))
      .filter((v) => v.date >= from && v.date <= today),
  };
}
