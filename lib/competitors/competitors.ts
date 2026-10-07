import { artwork, lookupApp, lookupApps, searchApps, type StoreApp } from "@/lib/appstore/itunes";
import { getCountry } from "@/lib/appstore/countries";
import { getApp } from "@/lib/aso/apps";
import { listKeywords, type TrackedKeyword } from "@/lib/aso/keywords";
import { estimateMonthlyDownloads, estimateMonthlyRevenue, normalizeTerm } from "@/lib/aso/scoring";
import { db, parseJson } from "@/lib/server/db";
import { HttpError } from "@/lib/server/http";
import { assertWithinLimit } from "@/lib/server/plans";
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
  data: unknown;
  created_at: string;
};

function rowsFor(workspaceId: string, appId: number) {
  return db.all<CompetitorRow>(
    "SELECT c.* FROM competitors c JOIN apps a ON a.id = c.app_id WHERE a.workspace_id = ? AND c.app_id = ? ORDER BY c.created_at ASC",
    [workspaceId, appId],
  );
}

async function getRow(workspaceId: string, id: number) {
  const row = await db.get<CompetitorRow>("SELECT c.* FROM competitors c JOIN apps a ON a.id = c.app_id WHERE a.workspace_id = ? AND c.id = ?", [workspaceId, id]);
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

export async function listCompetitors(workspaceId: string, appId: number, country: string): Promise<Competitor[]> {
  await getApp(workspaceId, appId);
  const c = getCountry(country).code;
  const rows = await rowsFor(workspaceId, appId);
  if (!rows.length) return [];
  const [fresh, keywords] = await Promise.all([lookupApps(rows.map((r) => r.track_id), c).catch(() => [] as StoreApp[]), listKeywords(workspaceId, appId, c)]);
  const byId = new Map(fresh.map((a) => [a.trackId, a]));
  return rows.map((row) => toCompetitor(row, byId.get(row.track_id), c, keywords));
}

export async function getCompetitor(workspaceId: string, id: number, country?: string): Promise<Competitor> {
  const row = await getRow(workspaceId, id);
  const c = getCountry(country ?? row.country).code;
  const [fresh, keywords] = await Promise.all([lookupApp(row.track_id, c).catch(() => undefined), listKeywords(workspaceId, row.app_id, c)]);
  return toCompetitor(row, fresh, c, keywords);
}

export async function addCompetitor(workspaceId: string, appId: number, trackId: number, country: string): Promise<Competitor> {
  const app = await getApp(workspaceId, appId);
  if (app.trackId === trackId) throw new HttpError(400, "An app cannot be its own competitor");
  const c = getCountry(country).code;
  const existing = await db.get<{ id: number }>("SELECT id FROM competitors WHERE app_id = ? AND track_id = ?", [appId, trackId]);
  if (existing) return getCompetitor(workspaceId, existing.id, c);
  await assertWithinLimit(workspaceId, "competitors");
  const store = await lookupApp(trackId, c);
  if (!store) throw new HttpError(404, "App not found on the App Store in this country");
  const row = await db.get<{ id: number }>(
    `INSERT INTO competitors (app_id, track_id, name, icon_url, developer, country, data) VALUES (?, ?, ?, ?, ?, ?, ?::jsonb)
     ON CONFLICT (app_id, track_id) DO UPDATE SET name = excluded.name RETURNING id`,
    [appId, trackId, store.trackName, artwork(store.artworkUrl512 ?? store.artworkUrl100, 256), store.sellerName, c, JSON.stringify(store)],
  );
  return getCompetitor(workspaceId, row!.id, c);
}

export async function deleteCompetitor(workspaceId: string, id: number) {
  await getRow(workspaceId, id);
  await db.run("DELETE FROM competitors c USING apps a WHERE a.id = c.app_id AND a.workspace_id = ? AND c.id = ?", [workspaceId, id]);
}

export async function compareKeywords(workspaceId: string, id: number, country: string): Promise<Comparison> {
  const row = await getRow(workspaceId, id);
  const c = getCountry(country).code;
  const keywords = await listKeywords(workspaceId, row.app_id, c);
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

export async function suggestCompetitors(workspaceId: string, appId: number, country: string): Promise<CompetitorSuggestion[]> {
  const app = await getApp(workspaceId, appId);
  const c = getCountry(country).code;
  const [rows, keywords] = await Promise.all([rowsFor(workspaceId, appId), listKeywords(workspaceId, appId, c)]);
  const excluded = new Set([app.trackId, ...rows.map((r) => r.track_id)]);
  const stats = new Map<number, CompetitorSuggestion & { positionSum: number }>();
  for (const kw of keywords) {
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
