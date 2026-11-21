import { deleteKeywords, listKeywords, type TrackedKeyword } from "@/lib/aso/keywords";
import { scoreTrackedKeywords } from "@/lib/relevance/tracked";
import { isCovered, withCoverage, type KeywordCoverage } from "./coverage";

export type PruneReason = "not-in-metadata" | "unranked" | "unrelated" | "brand" | "wrong-language";

export type PruneCandidate = { id: number; term: string; country: string; popularity: number | null; relevance: number | null; reasons: PruneReason[] };

export type PruneResult = { appId: number; country: string; scanned: number; candidates: PruneCandidate[]; byCountry: Record<string, number>; deleted: number };

type Judged = TrackedKeyword & { coverage: KeywordCoverage };

export function pruneReasons(k: Judged): PruneReason[] | null {
  if (k.liked || k.notes || isCovered(k.coverage) || k.position != null) return null;
  const off: PruneReason[] = [];
  if (!k.languageMatch) off.push("wrong-language");
  if (k.relevanceCategory === "unrelated") off.push("unrelated");
  if (k.relevanceCategory === "brand") off.push("brand");
  if (!off.length) return null;
  return ["not-in-metadata", "unranked", ...off];
}

export async function pruneCandidates(workspaceId: string, appId: number, country?: string): Promise<Omit<PruneResult, "deleted">> {
  let list = await listKeywords(workspaceId, appId, country);
  if (list.some((k) => !k.relevanceAt)) {
    await scoreTrackedKeywords(workspaceId, appId, country ?? "all").catch(() => undefined);
    list = await listKeywords(workspaceId, appId, country);
  }
  const judged = await withCoverage(workspaceId, appId, list);
  const candidates = judged.flatMap((k) => {
    const reasons = pruneReasons(k);
    return reasons ? [{ id: k.id, term: k.term, country: k.country, popularity: k.popularity, relevance: k.relevance, reasons }] : [];
  });
  const byCountry: Record<string, number> = {};
  for (const c of candidates) byCountry[c.country] = (byCountry[c.country] ?? 0) + 1;
  return { appId, country: country ?? "all", scanned: list.length, candidates, byCountry };
}

export async function pruneKeywords(workspaceId: string, appId: number, opts: { country?: string; apply: boolean; ids?: number[] }): Promise<PruneResult> {
  const preview = await pruneCandidates(workspaceId, appId, opts.country);
  const allowed = opts.ids ? new Set(opts.ids) : null;
  const ids = preview.candidates.filter((c) => !allowed || allowed.has(c.id)).map((c) => c.id);
  if (opts.apply && ids.length) await deleteKeywords(workspaceId, ids);
  return { ...preview, deleted: opts.apply ? ids.length : 0 };
}
