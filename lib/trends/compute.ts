import { monthlySearches, tapShare } from "@/lib/aso/scoring";
import {
  UNRANKED,
  type RankBuckets,
  type TrendContributor,
  type TrendCountry,
  type TrendKeyword,
  type TrendKpis,
  type TrendMover,
  type TrendMovers,
  type TrendPoint,
} from "./types";

export const TAP_TO_INSTALL = 0.4;
const DAY = 86400000;
const MOVER_LIMIT = 10;
const CONTRIBUTOR_LIMIT = 10;

export type SnapshotRow = {
  id: number;
  date: string;
  popularity: number | null;
  difficulty: number | null;
  position: number | null;
};

export type KeywordMeta = Pick<TrendKeyword, "id" | "term" | "country" | "popularitySource" | "relevanceCategory" | "target">;

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits;

export function windowDates(end: string, days: number) {
  const last = Date.parse(`${end}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => new Date(last - (days - 1 - i) * DAY).toISOString().slice(0, 10));
}

export function dailySearchInstalls(popularity: number | null, country: string, position: number | null) {
  if (popularity == null) return 0;
  return (monthlySearches(popularity, country) / 30) * tapShare(position) * TAP_TO_INSTALL;
}

export function rankedPosition(position: number | null) {
  return position != null && position >= 1 && position < UNRANKED ? position : null;
}

export function fillSeries(meta: KeywordMeta, dates: readonly string[], snapshots: readonly SnapshotRow[]): TrendKeyword {
  const sorted = [...snapshots].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const position: (number | null)[] = [];
  const popularity: (number | null)[] = [];
  const difficulty: (number | null)[] = [];
  let since: number | null = null;
  let cursor = 0;
  let last: SnapshotRow | null = null;
  dates.forEach((date, i) => {
    while (cursor < sorted.length && sorted[cursor].date <= date) last = sorted[cursor++];
    const current: SnapshotRow | null = last;
    if (current && since == null) since = i;
    position.push(current ? rankedPosition(current.position) : null);
    popularity.push(current?.popularity ?? null);
    difficulty.push(current?.difficulty ?? null);
  });
  return { ...meta, since, position, popularity, difficulty };
}

function emptyBuckets(): RankBuckets {
  return { top3: 0, top10: 0, top50: 0, top200: 0, unranked: 0 };
}

export function bucketOf(position: number | null): keyof RankBuckets {
  if (position == null) return "unranked";
  if (position <= 3) return "top3";
  if (position <= 10) return "top10";
  if (position <= 50) return "top50";
  return "top200";
}

export function aggregateDay(keywords: readonly TrendKeyword[], index: number, date: string): TrendPoint {
  const buckets = emptyBuckets();
  let tracked = 0;
  let installs = 0;
  let targets = 0;
  let targetInstalls = 0;
  let targetBest = 0;
  let positionSum = 0;
  let ranked = 0;
  for (const k of keywords) {
    if (k.since == null || index < k.since) continue;
    tracked++;
    const position = k.position[index];
    const popularity = k.popularity[index];
    buckets[bucketOf(position)]++;
    if (position != null) {
      positionSum += position;
      ranked++;
    }
    const est = dailySearchInstalls(popularity, k.country, position);
    installs += est;
    if (k.target) {
      targets++;
      targetInstalls += est;
      targetBest += dailySearchInstalls(popularity, k.country, 1);
    }
  }
  return {
    date,
    tracked,
    ...buckets,
    installs: round(installs, 2),
    targets,
    reach: targetBest > 0 ? round((100 * targetInstalls) / targetBest, 1) : null,
    avgPosition: ranked ? round(positionSum / ranked, 1) : null,
    top10Share: tracked ? round((buckets.top3 + buckets.top10) / tracked, 3) : null,
  };
}

function sameSetDelta(keywords: readonly TrendKeyword[], i: number) {
  let before = 0;
  let after = 0;
  let targetBefore = 0;
  let targetAfter = 0;
  let bestBefore = 0;
  let bestAfter = 0;
  for (const k of keywords) {
    if (k.since == null || i < k.since) continue;
    const b = dailySearchInstalls(k.popularity[i], k.country, k.position[i]);
    const a = dailySearchInstalls(k.popularity[i + 1], k.country, k.position[i + 1]);
    before += b;
    after += a;
    if (!k.target) continue;
    targetBefore += b;
    targetAfter += a;
    bestBefore += dailySearchInstalls(k.popularity[i], k.country, 1);
    bestAfter += dailySearchInstalls(k.popularity[i + 1], k.country, 1);
  }
  const share = (num: number, den: number) => (den > 0 ? (100 * num) / den : null);
  const rb = share(targetBefore, bestBefore);
  const ra = share(targetAfter, bestAfter);
  return { installs: after - before, reach: rb == null || ra == null ? 0 : ra - rb };
}

export function likeForLike(keywords: readonly TrendKeyword[], points: TrendPoint[]): TrendPoint[] {
  const end = points.length - 1;
  if (end < 1) return points;
  const installs: number[] = new Array(points.length);
  const reach: (number | null)[] = new Array(points.length);
  installs[end] = points[end].installs;
  reach[end] = points[end].reach;
  for (let i = end - 1; i >= 0; i--) {
    if (!points[i].tracked) {
      installs[i] = 0;
      reach[i] = null;
      continue;
    }
    const d = sameSetDelta(keywords, i);
    installs[i] = Math.max(0, installs[i + 1] - d.installs);
    const next = reach[i + 1];
    reach[i] = next == null ? points[i].reach : Math.min(100, Math.max(0, next - d.reach));
  }
  return points.map((p, i) => ({
    ...p,
    installsRaw: p.installs,
    reachRaw: p.reach,
    installs: round(installs[i], 2),
    reach: reach[i] == null ? null : round(reach[i] as number, 1),
  }));
}

export function kpisOf(point: TrendPoint | undefined): TrendKpis | null {
  if (!point || !point.tracked) return null;
  return {
    date: point.date,
    reach: point.reach,
    targets: point.targets,
    installs: point.installs,
    avgPosition: point.avgPosition,
    top10: point.top3 + point.top10,
    top3: point.top3,
    tracked: point.tracked,
  };
}

function change(start: number | null, end: number | null) {
  return start == null || end == null ? null : round(end - start, 1);
}

export function computeMovers(keywords: readonly TrendKeyword[], baseline: number | null, end: number): TrendMovers {
  const rows: TrendMover[] = [];
  if (baseline != null && baseline < end) {
    for (const k of keywords) {
      if (k.since == null || k.since > baseline) continue;
      const startPosition = k.position[baseline];
      const endPosition = k.position[end];
      rows.push({
        id: k.id,
        term: k.term,
        country: k.country,
        startPosition,
        endPosition,
        positionChange: (startPosition ?? UNRANKED) - (endPosition ?? UNRANKED),
        startPopularity: k.popularity[baseline],
        endPopularity: k.popularity[end],
        popularityChange: change(k.popularity[baseline], k.popularity[end]),
        startDifficulty: k.difficulty[baseline],
        endDifficulty: k.difficulty[end],
        difficultyChange: change(k.difficulty[baseline], k.difficulty[end]),
      });
    }
  }
  const byAbs = (key: "popularityChange" | "difficultyChange") =>
    rows
      .filter((r) => r[key] != null && r[key] !== 0)
      .sort((a, b) => Math.abs(b[key] ?? 0) - Math.abs(a[key] ?? 0))
      .slice(0, MOVER_LIMIT);
  return {
    gainers: rows
      .filter((r) => r.positionChange > 0)
      .sort((a, b) => b.positionChange - a.positionChange)
      .slice(0, MOVER_LIMIT),
    losers: rows
      .filter((r) => r.positionChange < 0)
      .sort((a, b) => a.positionChange - b.positionChange)
      .slice(0, MOVER_LIMIT),
    popularity: byAbs("popularityChange"),
    difficulty: byAbs("difficultyChange"),
  };
}

export function computeContributors(keywords: readonly TrendKeyword[], baseline: number | null, end: number, limit = CONTRIBUTOR_LIMIT): TrendContributor[] {
  if (baseline == null || baseline >= end) return [];
  const rows: TrendContributor[] = [];
  for (const k of keywords) {
    if (k.since == null) continue;
    const start = Math.max(baseline, k.since);
    if (start >= end) continue;
    const startInstalls = dailySearchInstalls(k.popularity[start], k.country, k.position[start]);
    const endInstalls = dailySearchInstalls(k.popularity[end], k.country, k.position[end]);
    const installsChange = endInstalls - startInstalls;
    if (Math.abs(installsChange) < 0.005) continue;
    rows.push({
      id: k.id,
      term: k.term,
      country: k.country,
      target: k.target,
      startPosition: k.position[start],
      endPosition: k.position[end],
      popularity: k.popularity[end],
      startInstalls: round(startInstalls, 2),
      endInstalls: round(endInstalls, 2),
      installsChange: round(installsChange, 2),
    });
  }
  return rows.sort((a, b) => Math.abs(b.installsChange) - Math.abs(a.installsChange)).slice(0, limit);
}

function bestOf(keywords: readonly TrendKeyword[], end: number): TrendCountry["bestKeyword"] {
  let best: TrendCountry["bestKeyword"] = null;
  for (const k of keywords) {
    const position = k.position[end];
    if (position == null) continue;
    const installs = dailySearchInstalls(k.popularity[end], k.country, position);
    if (!best || installs > best.installs || (installs === best.installs && position < (best.position ?? UNRANKED))) best = { id: k.id, term: k.term, position, installs: round(installs, 2) };
  }
  return best;
}

export function computeCountries(keywords: readonly TrendKeyword[], dates: readonly string[], baseline: number | null): TrendCountry[] {
  const end = dates.length - 1;
  const groups = new Map<string, TrendKeyword[]>();
  for (const k of keywords) groups.set(k.country, [...(groups.get(k.country) ?? []), k]);
  return [...groups]
    .map(([country, list]) => {
      const last = aggregateDay(list, end, dates[end]);
      const cohort = baseline == null ? [] : list.filter((k) => k.since != null && k.since <= baseline);
      const first = baseline == null || !cohort.length ? null : aggregateDay(cohort, baseline, dates[baseline]);
      const then = first ? aggregateDay(cohort, end, dates[end]) : null;
      const reachStart = first?.reach != null && then?.reach != null && last.reach != null ? round(Math.max(0, last.reach - (then.reach - first.reach)), 1) : null;
      return {
        country,
        keywords: list.length,
        targets: last.targets,
        reach: last.reach,
        reachStart,
        installs: last.installs,
        installsStart: first && then ? round(Math.max(0, last.installs - (then.installs - first.installs)), 2) : 0,
        top10: last.top3 + last.top10,
        bestKeyword: bestOf(list, end),
      };
    })
    .sort((a, b) => b.installs - a.installs || (b.reach ?? 0) - (a.reach ?? 0));
}
