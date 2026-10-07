import { clamp, monthlySearches, tapShare } from "@/lib/aso/scoring";
import type { Confidence, ImpactCountry, ImpactKeyword } from "./types";

export const DEFAULT_SEARCH_SHARE = 0.65;
export const TAP_TO_INSTALL = 0.4;
export const ALPHA_MIN = 0.2;
export const ALPHA_MAX = 5;
export const LIVE_POSITION = 50;
export const MIN_ARPU_USERS = 30;

export type Snapshot = { date: string; position: number | null; popularity: number | null };

export type DailyTrack = { positions: (number | null)[]; popularities: (number | null)[]; coverage: number };

export type ModelKeywordInput = {
  key: string;
  keywordId: number | null;
  term: string;
  country: string;
  popularitySource: "apple" | "estimate" | null;
  track: DailyTrack;
  paidInstalls: number;
  attributedRevenue: number | null;
};

export type ModelCountryInput = {
  country: string;
  observed: number[] | null;
  paid: number[];
  revenue: number | null;
};

export type ModelInput = {
  dates: string[];
  searchShare: number;
  countries: ModelCountryInput[];
  keywords: ModelKeywordInput[];
  appArpu: number | null;
  revenueAvailable: boolean;
};

export type ModelCountry = ImpactCountry & {
  daily: { observed: number[] | null; other: number[] | null; browse: number[] | null; paid: number[] };
};

export type ModelOutput = { countries: ModelCountry[]; keywords: ImpactKeyword[] };

const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

export function normalizeSearchShare(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : DEFAULT_SEARCH_SHARE;
}

export function rawDailyInstalls(popularity: number | null, country: string, position: number | null) {
  if (popularity == null) return 0;
  return (monthlySearches(popularity, country) / 30) * tapShare(position) * TAP_TO_INSTALL;
}

export function dailyTrack(dates: readonly string[], snapshots: readonly Snapshot[], fallback: { position: number | null; popularity: number | null }): DailyTrack {
  const sorted = [...snapshots].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const first = sorted[0] ?? null;
  const positions: (number | null)[] = [];
  const popularities: (number | null)[] = [];
  let cursor = 0;
  let last: Snapshot | null = null;
  let known = 0;
  for (const date of dates) {
    while (cursor < sorted.length && sorted[cursor].date <= date) last = sorted[cursor++];
    if (last) known++;
    const source = last ?? first;
    positions.push(source ? source.position : fallback.position);
    popularities.push(source?.popularity ?? fallback.popularity);
  }
  return { positions, popularities, coverage: dates.length ? known / dates.length : 0 };
}

export function calibrationFactor(searchShare: number, organic: number, raw: number) {
  if (raw <= 0) return { alpha: null, clamped: null };
  const value = (searchShare * organic) / raw;
  const alpha = clamp(value, ALPHA_MIN, ALPHA_MAX);
  return { alpha, clamped: value < ALPHA_MIN ? ("min" as const) : value > ALPHA_MAX ? ("max" as const) : null };
}

export function positionStability(positions: readonly (number | null)[]) {
  const ranked = positions.filter((p): p is number => p != null && p > 0);
  if (!ranked.length) return { stable: true, range: 0 };
  const sorted = [...ranked].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const range = sorted[sorted.length - 1] - sorted[0];
  const mixed = ranked.length !== positions.length;
  return { stable: !mixed && range <= Math.max(5, median * 0.5), range };
}

export function confidenceFor(input: {
  observed: number | null;
  stable: boolean;
  coverage: number;
  popularitySource: "apple" | "estimate" | null;
}): { level: Confidence; reasons: string[] } {
  const reasons: string[] = [];
  const volume = input.observed == null ? 0 : input.observed >= 300 ? 2 : input.observed >= 50 ? 1 : 0;
  if (input.observed == null) reasons.push("No observed installs to calibrate against");
  else if (volume < 2) reasons.push(`Only ${Math.round(input.observed)} observed installs in this country`);
  const steady = input.stable && input.coverage >= 0.5;
  if (!steady) reasons.push(input.coverage < 0.5 ? "Little ranking history in this window" : "Ranking moved a lot");
  const apple = input.popularitySource === "apple";
  if (!apple) reasons.push("Popularity is modelled, not Apple's value");
  const score = volume + (steady ? 1 : 0) + (apple ? 1 : 0);
  const level: Confidence = volume === 0 ? "low" : score >= 3 ? "high" : score >= 2 ? "medium" : "low";
  return { level, reasons };
}

function zeros(n: number) {
  return Array.from({ length: n }, () => 0);
}

export function runModel(input: ModelInput): ModelOutput {
  const { dates, searchShare } = input;
  const n = dates.length;
  const countries: ModelCountry[] = [];
  const keywords: ImpactKeyword[] = [];
  const byCountry = new Map<string, ModelKeywordInput[]>();
  for (const k of input.keywords) byCountry.set(k.country, [...(byCountry.get(k.country) ?? []), k]);
  const countryInputs = new Map(input.countries.map((c) => [c.country, c]));
  for (const code of byCountry.keys()) if (!countryInputs.has(code)) countryInputs.set(code, { country: code, observed: null, paid: zeros(n), revenue: null });

  for (const c of countryInputs.values()) {
    const list = byCountry.get(c.country) ?? [];
    const raw = list.map((k) => k.track.positions.map((p, i) => rawDailyInstalls(k.track.popularities[i], c.country, p)));
    const rawTotal = sum(raw.map(sum));
    const paidDaily = c.paid.length === n ? c.paid : zeros(n);
    const paid = sum(paidDaily);
    const organicDaily = c.observed ? c.observed.map((v, i) => Math.max(0, v - paidDaily[i])) : null;
    const observed = c.observed ? sum(c.observed) : null;
    const organic = organicDaily ? sum(organicDaily) : null;
    const calibration = organic != null ? calibrationFactor(searchShare, organic, rawTotal) : { alpha: 1, clamped: null };
    const alpha = calibration.alpha ?? 0;
    const est = raw.map((series) => series.map((v) => v * alpha));
    const estTotals = est.map(sum);
    const explained = sum(estTotals);
    const searchEstimate = organic != null ? searchShare * organic : null;
    const unexplained = searchEstimate != null ? Math.max(0, searchEstimate - explained) : null;
    const browse = organic != null ? (1 - searchShare) * organic : null;
    const explainedDaily = dates.map((_, i) => sum(est.map((s) => s[i])));
    const otherDaily = organicDaily ? organicDaily.map((v, i) => Math.max(0, searchShare * v - explainedDaily[i])) : null;
    const browseDaily = organicDaily ? organicDaily.map((v) => (1 - searchShare) * v) : null;
    const arpu = !input.revenueAvailable
      ? null
      : observed != null && observed >= MIN_ARPU_USERS && c.revenue != null
        ? { value: c.revenue / observed, source: "country" as const }
        : input.appArpu != null
          ? { value: input.appArpu, source: "app" as const }
          : null;

    let keywordRevenue: number | null = arpu ? 0 : null;
    let liveKeywords = 0;
    list.forEach((k, idx) => {
      const series = est[idx];
      const total = estTotals[idx];
      const stability = positionStability(k.track.positions);
      const confidence = confidenceFor({ observed, stable: stability.stable, coverage: k.track.coverage, popularitySource: k.popularitySource });
      const position = k.track.positions[n - 1] ?? null;
      const live = (position != null && position > 0 && position <= LIVE_POSITION) || k.paidInstalls > 0;
      if (live) liveKeywords++;
      const estRevenue = arpu ? total * arpu.value : null;
      if (keywordRevenue != null && estRevenue != null) keywordRevenue += estRevenue;
      const paidRevenue = k.attributedRevenue != null ? k.attributedRevenue : arpu && k.paidInstalls > 0 ? k.paidInstalls * arpu.value : null;
      keywords.push({
        key: k.key,
        keywordId: k.keywordId,
        term: k.term,
        country: c.country,
        position,
        positionStart: k.track.positions[0] ?? null,
        popularity: k.track.popularities[n - 1] ?? null,
        popularitySource: k.popularitySource,
        estDownloads: total,
        estPerDay: n ? total / n : 0,
        shareOfSearch: searchEstimate != null ? (searchEstimate > 0 ? total / searchEstimate : null) : explained > 0 ? total / explained : null,
        estRevenue,
        paidInstalls: k.paidInstalls,
        paidRevenue,
        paidRevenueSource: k.attributedRevenue != null ? "attributed" : paidRevenue != null ? "modelled" : null,
        confidence: confidence.level,
        confidenceReasons: confidence.reasons,
        live,
        series,
      });
    });

    countries.push({
      country: c.country,
      observed,
      paid,
      organic,
      searchEstimate,
      explained,
      unexplained,
      browse,
      alpha: organic != null ? calibration.alpha : null,
      alphaClamped: calibration.clamped,
      arpu: arpu?.value ?? null,
      arpuSource: arpu?.source ?? null,
      revenue: input.revenueAvailable ? (c.revenue ?? 0) : null,
      keywordRevenue,
      keywords: list.length,
      liveKeywords,
      daily: { observed: c.observed, other: otherDaily, browse: browseDaily, paid: paidDaily },
    });
  }
  countries.sort((a, b) => (b.observed ?? b.explained) - (a.observed ?? a.explained) || b.explained - a.explained);
  keywords.sort((a, b) => b.estDownloads - a.estDownloads || a.term.localeCompare(b.term));
  return { countries, keywords };
}
