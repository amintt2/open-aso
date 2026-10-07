import { searchApps, searchHints, type StoreApp, artwork } from "@/lib/appstore/itunes";
import { cached, HOUR } from "@/lib/server/cache";
import {
  difficultyFromResults,
  estimateMonthlyDownloads,
  estimateMonthlyRevenue,
  keywordDownloads,
  monthlySearches,
  normalizeTerm,
  opportunityScore,
  popularityFromHints,
  targetingLabel,
  titleMatch,
  type TargetingLabel,
} from "./scoring";

export type TopApp = {
  position: number;
  trackId: number;
  name: string;
  developer: string;
  iconUrl: string;
  rating: number;
  ratingCount: number;
  price: number;
  genre: string;
  releasedAt: string;
  updatedAt: string;
  downloadsEst: number;
  mrrEst: number;
  titleMatch: number;
};

export type KeywordAnalysis = {
  term: string;
  country: string;
  popularity: number;
  difficulty: number;
  difficultyBreakdown: { strength: number; relevance: number; saturation: number };
  position: number | null;
  resultsCount: number;
  monthlySearches: number;
  downloadsEst: number;
  top5Downloads: number;
  top5Mrr: number;
  opportunity: number;
  label: TargetingLabel;
  topApps: TopApp[];
  analyzedAt: string;
};

const PREFIX_STEPS = [1, 2, 3, 4, 5, 6, 8, 10, 13, 17, 22, 30];

function variantOf(t: string) {
  if (t.endsWith("ies")) return t.slice(0, -3) + "y";
  if (t.endsWith("s") && !t.endsWith("ss")) return t.slice(0, -1);
  return t + "s";
}

async function hintScore(t: string, country: string) {
  const own = await searchHints(t, country);
  const inOwnHints = own.includes(t);
  const completions = own.filter((h) => h !== t && h.startsWith(t)).length;
  let foundAtPrefix: number | null = null;
  let rankAtPrefix: number | null = null;
  const steps = [...PREFIX_STEPS.filter((s) => s < t.length), t.length];
  for (const len of steps) {
    const hints = await searchHints(t.slice(0, len), country);
    const idx = hints.indexOf(t);
    if (idx >= 0) {
      foundAtPrefix = len;
      rankAtPrefix = idx;
      break;
    }
  }
  const direct = popularityFromHints({ term: t, foundAtPrefix, rankAtPrefix, inOwnHints, completions });
  const tail = completions >= 3 ? Math.min(48, 14 + completions * 3) : 5;
  return Math.max(direct, tail);
}

export function popularity(term: string, country: string): Promise<number> {
  const t = normalizeTerm(term);
  return cached(`aso:popularity:v2:${country}:${t}`, 24 * HOUR, async () => {
    const direct = await hintScore(t, country);
    if (direct >= 40 || t.length < 4) return direct;
    const variant = await hintScore(variantOf(t), country);
    return Math.max(direct, variant - 6);
  });
}

export function toTopApp(app: StoreApp, index: number, term: string, country: string): TopApp {
  const downloadsEst = estimateMonthlyDownloads(app, country);
  return {
    position: index + 1,
    trackId: app.trackId,
    name: app.trackName,
    developer: app.sellerName,
    iconUrl: artwork(app.artworkUrl512 ?? app.artworkUrl100, 128),
    rating: Math.round(app.averageUserRating * 10) / 10,
    ratingCount: app.userRatingCount,
    price: app.price,
    genre: app.primaryGenreName,
    releasedAt: app.releaseDate,
    updatedAt: app.currentVersionReleaseDate,
    downloadsEst,
    mrrEst: estimateMonthlyRevenue(app, downloadsEst),
    titleMatch: Math.round(titleMatch(app, term) * 100) / 100,
  };
}

export async function analyzeKeyword(term: string, country: string, trackId?: number): Promise<KeywordAnalysis> {
  const t = normalizeTerm(term);
  const [pop, results] = await Promise.all([popularity(t, country), searchApps(t, country, 200)]);
  const diff = difficultyFromResults(results, t);
  const idx = trackId ? results.findIndex((r) => r.trackId === trackId) : -1;
  const position = idx >= 0 ? idx + 1 : null;
  const topApps = results.slice(0, 10).map((app, i) => toTopApp(app, i, t, country));
  const top5 = topApps.slice(0, 5);
  return {
    term: t,
    country,
    popularity: pop,
    difficulty: diff.score,
    difficultyBreakdown: diff.breakdown,
    position,
    resultsCount: results.length,
    monthlySearches: monthlySearches(pop, country),
    downloadsEst: keywordDownloads(pop, country, position),
    top5Downloads: top5.reduce((s, a) => s + a.downloadsEst, 0),
    top5Mrr: top5.reduce((s, a) => s + a.mrrEst, 0),
    opportunity: opportunityScore(pop, diff.score),
    label: targetingLabel(pop, diff.score, position),
    topApps,
    analyzedAt: new Date().toISOString(),
  };
}

export async function rankingsFor(trackId: number, terms: string[], country: string) {
  const out: { term: string; position: number | null }[] = [];
  for (const term of terms) {
    const results = await searchApps(normalizeTerm(term), country, 200);
    const idx = results.findIndex((r) => r.trackId === trackId);
    out.push({ term, position: idx >= 0 ? idx + 1 : null });
  }
  return out;
}
