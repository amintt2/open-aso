import type { TrackedKeyword } from "@/lib/aso/keywords";
import { listKeywords } from "@/lib/aso/keywords";
import { normalizeTerm } from "@/lib/aso/scoring";
import { db } from "@/lib/server/db";
import { mapLimit } from "@/lib/suggestions/jobs";
import { relevanceContext, scoreRelevance } from "./score";
import type { Relevance } from "./types";

export type TrackedRelevanceResult = { scored: number; judged: number; heuristic: number; countries: string[]; jevError?: string };

export async function saveKeywordRelevance(workspaceId: string, rows: { id: number; relevance: Relevance }[]) {
  if (!rows.length) return;
  await db.run(
    `UPDATE keywords k SET relevance = v.r, relevance_category = v.c, relevance_source = v.s, relevance_at = now()
     FROM unnest(?::bigint[], ?::real[], ?::text[], ?::text[]) AS v(id, r, c, s), apps a
     WHERE k.id = v.id AND a.id = k.app_id AND a.workspace_id = ?`,
    [rows.map((r) => r.id), rows.map((r) => r.relevance.relevance), rows.map((r) => r.relevance.category), rows.map((r) => r.relevance.source), workspaceId],
  );
}

export async function scoreKeywordsInCountry(workspaceId: string, appId: number, country: string, keywords?: TrackedKeyword[]) {
  const ctx = await relevanceContext(workspaceId, appId, country);
  const list = keywords ?? ctx.tracked;
  const run = await scoreRelevance(workspaceId, appId, list.map((k) => k.term), country, { context: ctx });
  const rows = list.flatMap((k) => {
    const relevance = run.scores.get(normalizeTerm(k.term));
    return relevance ? [{ id: k.id, relevance }] : [];
  });
  await saveKeywordRelevance(workspaceId, rows);
  return { run, rows };
}

export async function scoreTrackedKeywords(workspaceId: string, appId: number, country: string | "all"): Promise<TrackedRelevanceResult> {
  const all = await listKeywords(workspaceId, appId, country === "all" ? undefined : country);
  const byCountry = new Map<string, TrackedKeyword[]>();
  for (const k of all) byCountry.set(k.country, [...(byCountry.get(k.country) ?? []), k]);
  const result: TrackedRelevanceResult = { scored: 0, judged: 0, heuristic: 0, countries: [...byCountry.keys()] };
  await mapLimit([...byCountry], 2, async ([c, keywords]) => {
    const { run, rows } = await scoreKeywordsInCountry(workspaceId, appId, c, keywords);
    result.scored += rows.length;
    result.judged += rows.filter((r) => r.relevance.source === "jev").length;
    result.heuristic += rows.filter((r) => r.relevance.source === "heuristic").length;
    if (run.jevError) result.jevError ??= run.jevError;
  });
  return result;
}
