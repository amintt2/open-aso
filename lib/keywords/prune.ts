import { archiveKeywords, listKeywords, restoreKeywords, type TrackedKeyword } from "@/lib/aso/keywords";
import { listApps } from "@/lib/aso/apps";
import { scoreTrackedKeywords } from "@/lib/relevance/tracked";
import { cacheGet, cacheSet, DAY } from "@/lib/server/cache";
import { db } from "@/lib/server/db";
import { isCovered, withCoverage, type KeywordCoverage } from "./coverage";

export const UNRANKED_DAYS = 14;

export const AUTO_REASONS = ["auto", "clean-up"];

export type ArchiveReason = "not-in-metadata" | "unranked" | "unrelated" | "brand" | "wrong-language";

export type ArchiveCandidate = {
  id: number;
  term: string;
  country: string;
  popularity: number | null;
  relevance: number | null;
  lastRankedAt: string | null;
  bestPosition: number | null;
  reasons: ArchiveReason[];
};

export type ArchivePreview = { appId: number; country: string; scanned: number; candidates: ArchiveCandidate[]; byCountry: Record<string, number> };

type Judged = TrackedKeyword & { coverage: KeywordCoverage };

type RankFacts = { lastRankedAt: string | null; bestPosition: number | null };

function parseDay(value: string) {
  return Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value);
}

export function archiveReasons(k: Judged, facts?: RankFacts, now = Date.now()): ArchiveReason[] | null {
  if (k.liked || k.notes || isCovered(k.coverage) || k.position != null) return null;
  if (facts && now - parseDay(facts.lastRankedAt ?? k.createdAt) < UNRANKED_DAYS * DAY) return null;
  const reasons: ArchiveReason[] = ["not-in-metadata", "unranked"];
  if (!k.languageMatch) reasons.push("wrong-language");
  if (k.relevanceCategory === "unrelated") reasons.push("unrelated");
  if (k.relevanceCategory === "brand") reasons.push("brand");
  return reasons;
}

async function rankFacts(ids: number[]) {
  if (!ids.length) return new Map<number, RankFacts>();
  const rows = await db.all<{ id: number; last_ranked: string | null; best: number | null }>(
    `SELECT keyword_id AS id, max(date) FILTER (WHERE position BETWEEN 1 AND 200) AS last_ranked, min(position) FILTER (WHERE position BETWEEN 1 AND 200) AS best
     FROM keyword_snapshots WHERE keyword_id = ANY(?::bigint[]) GROUP BY keyword_id`,
    [ids],
  );
  return new Map(rows.map((r) => [r.id, { lastRankedAt: r.last_ranked, bestPosition: r.best }]));
}

export async function archiveCandidates(workspaceId: string, appId: number, country?: string): Promise<ArchivePreview> {
  let list = await listKeywords(workspaceId, appId, country);
  if (list.some((k) => !k.relevanceAt)) {
    await scoreTrackedKeywords(workspaceId, appId, country ?? "all").catch(() => undefined);
    list = await listKeywords(workspaceId, appId, country);
  }
  const [judged, facts] = await Promise.all([withCoverage(workspaceId, appId, list), rankFacts(list.map((k) => k.id))]);
  const candidates = judged.flatMap((k) => {
    const f = facts.get(k.id) ?? { lastRankedAt: null, bestPosition: null };
    const reasons = archiveReasons(k, f);
    return reasons ? [{ id: k.id, term: k.term, country: k.country, popularity: k.popularity, relevance: k.relevance, lastRankedAt: f.lastRankedAt, bestPosition: f.bestPosition, reasons }] : [];
  });
  const byCountry: Record<string, number> = {};
  for (const c of candidates) byCountry[c.country] = (byCountry[c.country] ?? 0) + 1;
  return { appId, country: country ?? "all", scanned: list.length, candidates, byCountry };
}

export async function archiveNoise(workspaceId: string, appId: number, opts: { country?: string; ids?: number[]; apply: boolean }) {
  const preview = await archiveCandidates(workspaceId, appId, opts.country);
  const allowed = opts.ids ? new Set(opts.ids) : null;
  const ids = preview.candidates.filter((c) => !allowed || allowed.has(c.id)).map((c) => c.id);
  const archived = opts.apply ? await archiveKeywords(workspaceId, ids, "clean-up") : 0;
  return { ...preview, archived };
}

export async function restoreCovered(workspaceId: string, appId: number) {
  const archived = await listKeywords(workspaceId, appId, undefined, { archived: "only" });
  const auto = archived.filter((k) => AUTO_REASONS.includes(k.archiveReason ?? ""));
  if (!auto.length) return 0;
  const judged = await withCoverage(workspaceId, appId, auto);
  return restoreKeywords(
    workspaceId,
    judged.filter((k) => isCovered(k.coverage)).map((k) => k.id),
  );
}

export async function syncArchive(workspaceId: string, appId: number) {
  const restored = await restoreCovered(workspaceId, appId);
  const preview = await archiveCandidates(workspaceId, appId);
  const archived = await archiveKeywords(
    workspaceId,
    preview.candidates.map((c) => c.id),
    "auto",
  );
  return { appId, restored, archived };
}

const SYNC_KEY = "keywords:archive:last-sync";

export async function runDailyArchiveSync() {
  const last = await cacheGet<string>(SYNC_KEY);
  if (last && Date.now() - Date.parse(last) < DAY) return null;
  await cacheSet(SYNC_KEY, new Date().toISOString(), 2 * DAY);
  const workspaces = await db.all<{ id: string }>("SELECT DISTINCT workspace_id AS id FROM apps");
  const results: { appId: number; restored: number; archived: number }[] = [];
  for (const w of workspaces)
    for (const app of await listApps(w.id)) {
      if (!app.isMine) continue;
      try {
        results.push(await syncArchive(w.id, app.id));
      } catch (error) {
        console.error(`[open-aso] archive sync failed for app ${app.id}`, error);
      }
    }
  const archived = results.reduce((s, r) => s + r.archived, 0);
  const restored = results.reduce((s, r) => s + r.restored, 0);
  if (archived || restored) console.info(`[open-aso] archive sync: archived ${archived}, restored ${restored}`);
  return results;
}
