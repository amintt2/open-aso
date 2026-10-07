import { db, parseJson } from "@/lib/server/db";
import { assertWithinLimit } from "@/lib/server/plans";
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
  liked: boolean;
  popularity: number | null;
  popularity_source: string | null;
  difficulty: number | null;
  position: number | null;
  downloads_est: number | null;
  top5_downloads: number | null;
  top5_mrr: number | null;
  label: string | null;
  results_count: number | null;
  top_apps: unknown;
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
  popularitySource: "apple" | "estimate" | null;
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
    popularitySource: (row.popularity_source as "apple" | "estimate" | null) ?? (row.popularity == null ? null : "estimate"),
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

const SELECT = `SELECT k.*, (SELECT s.position FROM keyword_snapshots s WHERE s.keyword_id = k.id AND s.date < current_date ORDER BY s.date DESC LIMIT 1) AS prev_position FROM keywords k JOIN apps a ON a.id = k.app_id`;

export async function listKeywords(workspaceId: string, appId: number, country?: string): Promise<TrackedKeyword[]> {
  await getApp(workspaceId, appId);
  const rows = country
    ? await db.all<KeywordRow>(`${SELECT} WHERE a.workspace_id = ? AND k.app_id = ? AND k.country = ? ORDER BY k.created_at DESC`, [workspaceId, appId, country])
    : await db.all<KeywordRow>(`${SELECT} WHERE a.workspace_id = ? AND k.app_id = ? ORDER BY k.created_at DESC`, [workspaceId, appId]);
  return rows.map(toKeyword);
}

export async function getKeyword(workspaceId: string, id: number): Promise<TrackedKeyword> {
  const row = await db.get<KeywordRow>(`${SELECT} WHERE a.workspace_id = ? AND k.id = ?`, [workspaceId, id]);
  if (!row) throw new HttpError(404, "Keyword not found");
  return toKeyword(row);
}

export async function addKeywords(workspaceId: string, appId: number, terms: string[], country: string): Promise<TrackedKeyword[]> {
  await getApp(workspaceId, appId);
  const clean = [...new Set(terms.map(normalizeTerm).filter(Boolean))];
  if (!clean.length) return [];
  const existing = new Set(
    (await db.all<{ term: string }>("SELECT term FROM keywords WHERE app_id = ? AND country = ? AND term = ANY(?::text[])", [appId, country, clean])).map((r) => r.term),
  );
  const fresh = clean.filter((t) => !existing.has(t));
  if (fresh.length) await assertWithinLimit(workspaceId, "keywords", fresh.length);
  await db.tx(async (t) => {
    for (const term of fresh) await t.run("INSERT INTO keywords (app_id, term, country) VALUES (?, ?, ?) ON CONFLICT DO NOTHING", [appId, term, country]);
  });
  const rows = await db.all<KeywordRow>(`${SELECT} WHERE a.workspace_id = ? AND k.app_id = ? AND k.country = ? AND k.term = ANY(?::text[])`, [
    workspaceId,
    appId,
    country,
    clean,
  ]);
  return rows.map(toKeyword);
}

export async function updateKeyword(workspaceId: string, id: number, patch: { notes?: string | null; liked?: boolean }) {
  await getKeyword(workspaceId, id);
  if (patch.notes !== undefined) await db.run("UPDATE keywords SET notes = ? WHERE id = ?", [patch.notes, id]);
  if (patch.liked !== undefined) await db.run("UPDATE keywords SET liked = ? WHERE id = ?", [patch.liked, id]);
  return getKeyword(workspaceId, id);
}

export async function setKeywordsLiked(workspaceId: string, ids: number[], liked: boolean) {
  await db.run("UPDATE keywords k SET liked = ? FROM apps a WHERE a.id = k.app_id AND a.workspace_id = ? AND k.id = ANY(?::bigint[])", [liked, workspaceId, ids]);
}

export async function deleteKeywords(workspaceId: string, ids: number[]) {
  await db.run("DELETE FROM keywords k USING apps a WHERE a.id = k.app_id AND a.workspace_id = ? AND k.id = ANY(?::bigint[])", [workspaceId, ids]);
}

export async function saveAnalysis(id: number, a: KeywordAnalysis) {
  await db.run(
    `UPDATE keywords SET popularity = ?, popularity_source = ?, difficulty = ?, position = ?, downloads_est = ?, top5_downloads = ?, top5_mrr = ?,
     label = ?, results_count = ?, top_apps = ?::jsonb, last_refreshed_at = now() WHERE id = ?`,
    [a.popularity, a.popularitySource, a.difficulty, a.position, a.downloadsEst, a.top5Downloads, a.top5Mrr, a.label, a.resultsCount, JSON.stringify(a.topApps), id],
  );
  await db.run(
    `INSERT INTO keyword_snapshots (keyword_id, date, popularity, difficulty, position) VALUES (?, current_date, ?, ?, ?)
     ON CONFLICT (keyword_id, date) DO UPDATE SET popularity = excluded.popularity, difficulty = excluded.difficulty, position = excluded.position`,
    [id, a.popularity, a.difficulty, a.position],
  );
}

async function refreshRow(id: number) {
  const row = await db.get<{ term: string; country: string; track_id: number; workspace_id: string }>(
    "SELECT k.term, k.country, a.track_id, a.workspace_id FROM keywords k JOIN apps a ON a.id = k.app_id WHERE k.id = ?",
    [id],
  );
  if (!row) throw new HttpError(404, "Keyword not found");
  await saveAnalysis(id, await analyzeKeyword(row.term, row.country, row.track_id, row.workspace_id));
}

export async function refreshKeyword(workspaceId: string, id: number): Promise<TrackedKeyword> {
  await getKeyword(workspaceId, id);
  await refreshRow(id);
  return getKeyword(workspaceId, id);
}

export async function refreshKeywords(workspaceId: string | null, ids: number[], concurrency = 4) {
  const allowed = workspaceId
    ? new Set(
        (await db.all<{ id: number }>("SELECT k.id FROM keywords k JOIN apps a ON a.id = k.app_id WHERE a.workspace_id = ? AND k.id = ANY(?::bigint[])", [workspaceId, ids])).map(
          (r) => r.id,
        ),
      )
    : new Set(ids);
  const results: { id: number; ok: boolean; error?: string }[] = [];
  const queue = ids.filter((id) => allowed.has(id));
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (cursor < queue.length) {
        const id = queue[cursor++];
        try {
          await refreshRow(id);
          results.push({ id, ok: true });
        } catch (error) {
          results.push({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }),
  );
  return results;
}

export async function keywordHistory(workspaceId: string, id: number) {
  await getKeyword(workspaceId, id);
  return db.all<{ date: string; popularity: number | null; difficulty: number | null; position: number | null }>(
    "SELECT date, popularity, difficulty, position FROM keyword_snapshots WHERE keyword_id = ? ORDER BY date ASC",
    [id],
  );
}
