import { artwork, lookupApp, lookupApps, searchApps, type StoreApp } from "@/lib/appstore/itunes";
import { getCountry } from "@/lib/appstore/countries";
import { getApp } from "@/lib/aso/apps";
import { listKeywords, type TrackedKeyword } from "@/lib/aso/keywords";
import { estimateMonthlyDownloads, estimateMonthlyRevenue, normalizeTerm } from "@/lib/aso/scoring";
import { db, parseJson } from "@/lib/server/db";
import { HttpError } from "@/lib/server/http";
import { pool } from "@/lib/explore/pool";
import type { Comparison, ComparisonRow, Competitor, CompetitorSuggestion } from "./types";

type CompetitorRow = {
  id: number;
  app_id: number;
  track_id: number;
  name: string;
  icon_url: string | null;
  developer: string | null;
  country: string;
  data: string | null;
  created_at: string;
};

function rowsFor(appId: number) {
  return db().prepare("SELECT * FROM competitors WHERE app_id = ? ORDER BY created_at ASC").all(appId) as CompetitorRow[];
}

function getRow(id: number) {
  const row = db().prepare("SELECT * FROM competitors WHERE id = ?").get(id) as CompetitorRow | undefined;
  if (!row) throw new HttpError(404, "Competitor not found");
  return row;
}

function keywordStats(trackId: number, keywords: TrackedKeyword[]) {
  let outranksMe = 0;
  let sharedKeywords = 0;
  for (const kw of keywords) {
    const hit = kw.topApps.find((a) => a.trackId === trackId);
    if (!hit) continue;
    sharedKeywords++;
    if (kw.position == null || hit.position < kw.position) outranksMe++;
  }
  return { outranksMe, sharedKeywords };
}

function toCompetitor(row: CompetitorRow, fresh: StoreApp | undefined, country: string, keywords: TrackedKeyword[]): Competitor {
  const store = fresh ?? parseJson<StoreApp | null>(row.data, null);
  const downloadsEst = store ? estimateMonthlyDownloads(store, country) : null;
  return {
    id: row.id,
    appId: row.app_id,
    trackId: row.track_id,
    name: store?.trackName ?? row.name,
    iconUrl: store ? artwork(store.artworkUrl512 ?? store.artworkUrl100, 256) : row.icon_url,
    developer: store?.sellerName ?? row.developer,
    country: row.country,
    createdAt: row.created_at,
    rating: store ? Math.round(store.averageUserRating * 100) / 100 : null,
    ratingCount: store?.userRatingCount ?? null,
    price: store?.price ?? null,
    genre: store?.primaryGenreName ?? null,
    version: store?.version ?? null,
    updatedAt: store?.currentVersionReleaseDate ?? null,
    storeUrl: store?.trackViewUrl ?? null,
    downloadsEst,
    revenueEst: store && downloadsEst != null ? estimateMonthlyRevenue(store, downloadsEst) : null,
    ...keywordStats(row.track_id, keywords),
  };
}

export async function listCompetitors(appId: number, country: string): Promise<Competitor[]> {
  getApp(appId);
  const c = getCountry(country).code;
  const rows = rowsFor(appId);
  if (!rows.length) return [];
  const fresh = await lookupApps(rows.map((r) => r.track_id), c).catch(() => [] as StoreApp[]);
  const byId = new Map(fresh.map((a) => [a.trackId, a]));
  const keywords = listKeywords(appId, c);
  return rows.map((row) => toCompetitor(row, byId.get(row.track_id), c, keywords));
}

export async function getCompetitor(id: number, country?: string): Promise<Competitor> {
  const row = getRow(id);
  const c = getCountry(country ?? row.country).code;
  const fresh = await lookupApp(row.track_id, c).catch(() => undefined);
  return toCompetitor(row, fresh, c, listKeywords(row.app_id, c));
}

export async function addCompetitor(appId: number, trackId: number, country: string): Promise<Competitor> {
  const app = getApp(appId);
  if (app.trackId === trackId) throw new HttpError(400, "An app cannot be its own competitor");
  const c = getCountry(country).code;
  const existing = db().prepare("SELECT id FROM competitors WHERE app_id = ? AND track_id = ?").get(appId, trackId) as { id: number } | undefined;
  if (existing) return getCompetitor(existing.id, c);
  const store = await lookupApp(trackId, c);
  if (!store) throw new HttpError(404, "App not found on the App Store in this country");
  const info = db()
    .prepare("INSERT INTO competitors (app_id, track_id, name, icon_url, developer, country, data) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(appId, trackId, store.trackName, artwork(store.artworkUrl512 ?? store.artworkUrl100, 256), store.sellerName, c, JSON.stringify(store));
  return getCompetitor(Number(info.lastInsertRowid), c);
}

export function deleteCompetitor(id: number) {
  getRow(id);
  db().prepare("DELETE FROM competitors WHERE id = ?").run(id);
}

export async function compareKeywords(id: number, country: string): Promise<Comparison> {
  const row = getRow(id);
  const c = getCountry(country).code;
  const keywords = listKeywords(row.app_id, c);
  const rows = await pool(keywords, 4, async (kw): Promise<ComparisonRow> => {
    const top = kw.topApps.find((a) => a.trackId === row.track_id);
    let theirPosition = top?.position ?? null;
    if (!top) {
      const results = await searchApps(normalizeTerm(kw.term), c, 200).catch(() => [] as StoreApp[]);
      const idx = results.findIndex((r) => r.trackId === row.track_id);
      theirPosition = idx >= 0 ? idx + 1 : null;
    }
    return {
      keywordId: kw.id,
      term: kw.term,
      popularity: kw.popularity,
      difficulty: kw.difficulty,
      myPosition: kw.position,
      theirPosition,
    };
  });
  const rank = (p: number | null) => p ?? Infinity;
  return {
    competitorId: id,
    country: c,
    rows,
    theyLead: rows.filter((r) => r.theirPosition != null && rank(r.theirPosition) < rank(r.myPosition)).length,
    iLead: rows.filter((r) => r.myPosition != null && rank(r.myPosition) < rank(r.theirPosition)).length,
    bothRank: rows.filter((r) => r.myPosition != null && r.theirPosition != null).length,
    onlyThey: rows.filter((r) => r.myPosition == null && r.theirPosition != null).length,
  };
}

export function suggestCompetitors(appId: number, country: string): CompetitorSuggestion[] {
  const app = getApp(appId);
  const c = getCountry(country).code;
  const excluded = new Set([app.trackId, ...rowsFor(appId).map((r) => r.track_id)]);
  const stats = new Map<number, CompetitorSuggestion & { positionSum: number }>();
  for (const kw of listKeywords(appId, c)) {
    for (const top of kw.topApps) {
      if (excluded.has(top.trackId)) continue;
      const entry = stats.get(top.trackId) ?? {
        trackId: top.trackId,
        name: top.name,
        developer: top.developer,
        iconUrl: top.iconUrl,
        rating: top.rating,
        ratingCount: top.ratingCount,
        appearances: 0,
        bestPosition: top.position,
        avgPosition: 0,
        positionSum: 0,
        keywords: [],
      };
      entry.appearances++;
      entry.positionSum += top.position;
      entry.bestPosition = Math.min(entry.bestPosition, top.position);
      if (entry.keywords.length < 6) entry.keywords.push(kw.term);
      stats.set(top.trackId, entry);
    }
  }
  return [...stats.values()]
    .map(({ positionSum, ...s }) => ({ ...s, avgPosition: Math.round((positionSum / s.appearances) * 10) / 10 }))
    .sort((a, b) => b.appearances - a.appearances || a.avgPosition - b.avgPosition)
    .slice(0, 12);
}
