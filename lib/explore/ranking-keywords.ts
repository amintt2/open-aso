import { lookupApp, searchApps, searchHints, type StoreApp } from "@/lib/appstore/itunes";
import { getCountry } from "@/lib/appstore/countries";
import { popularity } from "@/lib/aso/analyze";
import { normalizeTerm } from "@/lib/aso/scoring";
import { cached, HOUR } from "@/lib/server/cache";
import { HttpError } from "@/lib/server/http";
import { pool } from "./pool";
import { countGrams, isMeaningful, tokenize } from "./text";
import type { RankingKeyword } from "./types";

const MAX_CANDIDATES = 40;

function addCandidate(map: Map<string, { term: string; weight: number; source: RankingKeyword["source"] }>, term: string, weight: number, source: RankingKeyword["source"]) {
  const t = normalizeTerm(term);
  if (!t || t.length < 2 || t.length > 60) return;
  const existing = map.get(t);
  if (existing) {
    existing.weight += weight;
    return;
  }
  map.set(t, { term: t, weight, source });
}

async function buildCandidates(app: StoreApp, subtitle: string | null, country: string) {
  const map = new Map<string, { term: string; weight: number; source: RankingKeyword["source"] }>();
  const titleGrams = [...countGrams([app.trackName], 3).keys()];
  titleGrams.forEach((g) => addCandidate(map, g, 100 - g.split(" ").length * 5, "title"));
  if (subtitle) [...countGrams([subtitle], 3).keys()].forEach((g) => addCandidate(map, g, 80, "subtitle"));

  const description = countGrams(app.description.split(/\n+/), 3);
  [...description.entries()]
    .filter(([gram, count]) => count >= 2 || gram.split(" ").length === 1)
    .sort((a, b) => b[1] * b[0].split(" ").length - a[1] * a[0].split(" ").length)
    .slice(0, 30)
    .forEach(([gram, count]) => addCandidate(map, gram, Math.min(40, count * 6), "description"));

  const titleTerms = tokenize(app.trackName).filter(isMeaningful).slice(0, 3);
  const hintLists = await Promise.all(titleTerms.map((t) => searchHints(t, country).catch(() => [] as string[])));
  hintLists.forEach((hints) => hints.slice(0, 6).forEach((h, i) => addCandidate(map, h, 45 - i * 4, "hint")));

  const genre = app.primaryGenreName?.toLowerCase();
  if (genre && !genre.includes("&")) addCandidate(map, genre, 20, "genre");

  return [...map.values()].sort((a, b) => b.weight - a.weight).slice(0, MAX_CANDIDATES);
}

export function discoverRankingKeywords(trackId: number, country: string, subtitle?: string | null, opts: { popularity?: boolean } = {}): Promise<RankingKeyword[]> {
  const withPopularity = opts.popularity !== false;
  const c = getCountry(country).code;
  const sub = subtitle ? normalizeTerm(subtitle).slice(0, 60) : "";
  return cached(`explore:ranking:v3:${c}:${trackId}:${sub}${withPopularity ? "" : ":nopop"}`, 12 * HOUR, async () => {
    const app = await lookupApp(trackId, c);
    if (!app) throw new HttpError(404, "App not available in this storefront");
    const candidates = await buildCandidates(app, sub || null, c);
    const positions = await pool(candidates, 6, async (cand) => {
      const results = await searchApps(cand.term, c, 200).catch(() => [] as StoreApp[]);
      const idx = results.findIndex((r) => r.trackId === trackId);
      return { ...cand, position: idx >= 0 ? idx + 1 : null, resultsCount: results.length };
    });
    const ranking = positions.filter((p): p is typeof p & { position: number } => p.position !== null);
    const scored = await pool(ranking, 4, async (r) => ({
      term: r.term,
      position: r.position,
      popularity: withPopularity ? await popularity(r.term, c).catch(() => null) : null,
      resultsCount: r.resultsCount,
      source: r.source,
    }));
    return scored.sort((a, b) => a.position - b.position || (b.popularity ?? 0) - (a.popularity ?? 0));
  });
}
