import { db, parseJson } from "@/lib/server/db";
import { HttpError } from "@/lib/server/http";
import { analyzeKeyword, type KeywordAnalysis, type TopApp } from "./analyze";
import { getApp } from "./apps";
import { normalizeTerm, opportunityScore, type TargetingLabel } from "./scoring";

type KeywordRow = {
  id: number;
  app_id: number;
  term: string;
  country: string;
  notes: string | null;
  liked: number;
  popularity: number | null;
  difficulty: number | null;
  position: number | null;
  downloads_est: number | null;
  top5_downloads: number | null;
  top5_mrr: number | null;
  label: string | null;
  results_count: number | null;
  top_apps: string | null;
  last_refreshed_at: string | null;
  created_at: string;
  prev_position?: number | null;
};

export type TrackedKeyword = {
  id: number;
  appId: number;
  term: string;
  country: string;
  notes: string | null;
  liked: boolean;
  popularity: number | null;
  difficulty: number | null;
  opportunity: number | null;
  position: number | null;
  positionChange: number | null;
  downloadsEst: number | null;
  top5Downloads: number | null;
  top5Mrr: number | null;
  label: TargetingLabel | null;
  resultsCount: number | null;
  topApps: TopApp[];
  lastRefreshedAt: string | null;
  createdAt: string;
};

function toKeyword(row: KeywordRow): TrackedKeyword {
  const change =
    row.position != null && row.prev_position != null ? row.prev_position - row.position : null;
  return {
    id: row.id,
    appId: row.app_id,
    term: row.term,
    country: row.country,
    notes: row.notes,
    liked: !!row.liked,
    popularity: row.popularity,
    difficulty: row.difficulty,
    opportunity:
      row.popularity != null && row.difficulty != null
        ? opportunityScore(row.popularity, row.difficulty)
        : null,
    position: row.position,
    positionChange: change,
    downloadsEst: row.downloads_est,
    top5Downloads: row.top5_downloads,
    top5Mrr: row.top5_mrr,
    label: row.label as TargetingLabel | null,
    resultsCount: row.results_count,
    topApps: parseJson<TopApp[]>(row.top_apps, []),
    lastRefreshedAt: row.last_refreshed_at,
    createdAt: row.created_at,
  };
}

const SELECT = `SELECT k.*, (SELECT s.position FROM keyword_snapshots s WHERE s.keyword_id = k.id AND s.date < date('now') ORDER BY s.date DESC LIMIT 1) AS prev_position FROM keywords k`;

export function listKeywords(appId: number, country?: string): TrackedKeyword[] {
  const rows = country
    ? db().prepare(`${SELECT} WHERE k.app_id = ? AND k.country = ? ORDER BY k.created_at DESC`).all(appId, country)
    : db().prepare(`${SELECT} WHERE k.app_id = ? ORDER BY k.created_at DESC`).all(appId);
  return (rows as KeywordRow[]).map(toKeyword);
}

export function getKeyword(id: number): TrackedKeyword {
  const row = db().prepare(`${SELECT} WHERE k.id = ?`).get(id) as KeywordRow | undefined;
  if (!row) throw new HttpError(404, "Keyword not found");
  return toKeyword(row);
}

export function addKeywords(appId: number, terms: string[], country: string): TrackedKeyword[] {
  getApp(appId);
  const insert = db().prepare("INSERT OR IGNORE INTO keywords (app_id, term, country) VALUES (?, ?, ?)");
  const clean = [...new Set(terms.map(normalizeTerm).filter(Boolean))];
  const tx = db().transaction(() => clean.forEach((t) => insert.run(appId, t, country)));
  tx();
  const rows = db()
    .prepare(`${SELECT} WHERE k.app_id = ? AND k.country = ? AND k.term IN (${clean.map(() => "?").join(",") || "''"})`)
    .all(appId, country, ...clean) as KeywordRow[];
  return rows.map(toKeyword);
}

export function updateKeyword(id: number, patch: { notes?: string | null; liked?: boolean }) {
  getKeyword(id);
  if (patch.notes !== undefined) db().prepare("UPDATE keywords SET notes = ? WHERE id = ?").run(patch.notes, id);
  if (patch.liked !== undefined) db().prepare("UPDATE keywords SET liked = ? WHERE id = ?").run(patch.liked ? 1 : 0, id);
  return getKeyword(id);
}

export function deleteKeywords(ids: number[]) {
  const del = db().prepare("DELETE FROM keywords WHERE id = ?");
  db().transaction(() => ids.forEach((id) => del.run(id)))();
}

export function saveAnalysis(id: number, a: KeywordAnalysis) {
  db()
    .prepare(
      `UPDATE keywords SET popularity = ?, difficulty = ?, position = ?, downloads_est = ?, top5_downloads = ?, top5_mrr = ?,
       label = ?, results_count = ?, top_apps = ?, last_refreshed_at = datetime('now') WHERE id = ?`,
    )
    .run(a.popularity, a.difficulty, a.position, a.downloadsEst, a.top5Downloads, a.top5Mrr, a.label, a.resultsCount, JSON.stringify(a.topApps), id);
  db()
    .prepare(
      `INSERT INTO keyword_snapshots (keyword_id, date, popularity, difficulty, position) VALUES (?, date('now'), ?, ?, ?)
       ON CONFLICT(keyword_id, date) DO UPDATE SET popularity = excluded.popularity, difficulty = excluded.difficulty, position = excluded.position`,
    )
    .run(id, a.popularity, a.difficulty, a.position);
}

export async function refreshKeyword(id: number): Promise<TrackedKeyword> {
  const kw = getKeyword(id);
  const app = getApp(kw.appId);
  const analysis = await analyzeKeyword(kw.term, kw.country, app.trackId);
  saveAnalysis(id, analysis);
  return getKeyword(id);
}

export async function refreshKeywords(ids: number[], concurrency = 4) {
  const results: { id: number; ok: boolean; error?: string }[] = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, ids.length) }, async () => {
      while (cursor < ids.length) {
        const id = ids[cursor++];
        try {
          await refreshKeyword(id);
          results.push({ id, ok: true });
        } catch (error) {
          results.push({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }),
  );
  return results;
}

export function staleKeywordIds(maxAgeHours = 20) {
  return (
    db()
      .prepare(
        `SELECT id FROM keywords WHERE last_refreshed_at IS NULL OR last_refreshed_at < datetime('now', ?) ORDER BY last_refreshed_at ASC NULLS FIRST`,
      )
      .all(`-${maxAgeHours} hours`) as { id: number }[]
  ).map((r) => r.id);
}

export function keywordHistory(id: number) {
  return db()
    .prepare("SELECT date, popularity, difficulty, position FROM keyword_snapshots WHERE keyword_id = ? ORDER BY date ASC")
    .all(id) as { date: string; popularity: number | null; difficulty: number | null; position: number | null }[];
}
