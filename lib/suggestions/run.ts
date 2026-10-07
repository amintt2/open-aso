import { analyzeKeyword, type KeywordAnalysis } from "@/lib/aso/analyze";
import { getApp } from "@/lib/aso/apps";
import { listKeywords } from "@/lib/aso/keywords";
import { cached, cacheGet, cacheSet, DAY, HOUR, wsKey } from "@/lib/server/cache";
import { db } from "@/lib/server/db";
import { HttpError } from "@/lib/server/http";
import { isTypesafeConfigured } from "@/lib/ai/typesafe";
import { isRelevant, type Relevance } from "@/lib/relevance/types";
import { relevanceContext, scoreRelevance } from "@/lib/relevance/score";
import { aiAvailable } from "./ai";
import { generateCandidates, type Candidate } from "./generate";
import { findRunningJob, mapLimit, publicJob, startJob, type JobState } from "./jobs";
import { combinedScore, type FilteredSuggestion, type Suggestion, type SuggestionsOverview, type SuggestionsResult } from "./types";

export const MIN_TRACKED = 3;
const MAX_SCORED = 40;
const MAX_FILTERED = 300;
const RELEVANCE_BUCKET = 5;
const JOB_KIND = "suggestions";

function lastKey(workspaceId: string, appId: number, country: string) {
  return wsKey(workspaceId, `suggestions:last:${appId}:${country}`);
}

function jobKey(workspaceId: string, appId: number, country: string) {
  return `${workspaceId}:${appId}:${country}`;
}

export async function competitorNames(workspaceId: string, appId: number): Promise<string[]> {
  const rows = await db.all<{ name: string }>("SELECT c.name FROM competitors c JOIN apps a ON a.id = c.app_id WHERE a.workspace_id = ? AND c.app_id = ?", [
    workspaceId,
    appId,
  ]);
  return rows.map((r) => r.name);
}

export function analyzeCached(term: string, country: string, trackId: number): Promise<KeywordAnalysis> {
  return cached(`suggestions:analysis:${country}:${trackId}:${term}`, 12 * HOUR, () => analyzeKeyword(term, country, trackId));
}

function toSuggestion(a: KeywordAnalysis, sources: Suggestion["sources"], r?: Relevance): Suggestion {
  return {
    term: a.term,
    sources,
    popularity: a.popularity,
    difficulty: a.difficulty,
    opportunity: a.opportunity,
    label: a.label,
    position: a.position,
    downloadsEst: a.downloadsEst,
    monthlySearches: a.monthlySearches,
    resultsCount: a.resultsCount,
    ...(r ? { relevance: r.relevance, category: r.category, relevanceSource: r.source, score: combinedScore(r.relevance, a.opportunity) } : {}),
  };
}

function byRelevance(scores: Map<string, Relevance>) {
  const bucket = (c: Candidate) => Math.floor((scores.get(c.term)?.relevance ?? 0) / RELEVANCE_BUCKET);
  return (a: Candidate, b: Candidate) => bucket(b) - bucket(a) || b.weight - a.weight;
}

function toFiltered(c: Candidate, r: Relevance): FilteredSuggestion {
  return { term: c.term, sources: c.sources, relevance: r.relevance, category: r.category, languageMatch: r.languageMatch, relevanceSource: r.source };
}

export async function suggestionsOverview(workspaceId: string, appId: number, country: string): Promise<SuggestionsOverview> {
  await getApp(workspaceId, appId);
  const running = findRunningJob<SuggestionsResult>(JOB_KIND, jobKey(workspaceId, appId, country));
  const [last, ai, tracked] = await Promise.all([
    cacheGet<SuggestionsResult>(lastKey(workspaceId, appId, country)),
    aiAvailable(workspaceId),
    listKeywords(workspaceId, appId, country),
  ]);
  return {
    last: last ?? null,
    running: running ? publicJob(running) : null,
    aiAvailable: ai,
    trackedCount: tracked.length,
  };
}

export async function startSuggestions(workspaceId: string, appId: number, country: string, useAi: boolean): Promise<JobState<SuggestionsResult>> {
  const app = await getApp(workspaceId, appId);
  const tracked = await listKeywords(workspaceId, appId, country);
  if (tracked.length < MIN_TRACKED) throw new HttpError(400, `Add at least ${MIN_TRACKED} keywords in this country to unlock suggestions`);
  const withAi = useAi && (await aiAvailable(workspaceId));

  return startJob<SuggestionsResult>(JOB_KIND, jobKey(workspaceId, appId, country), async (job) => {
    job.setStage("Generating candidates", 0);
    const { candidates, aiError, usedAi } = await generateCandidates({
      workspaceId,
      app,
      country,
      tracked,
      competitors: await competitorNames(workspaceId, appId),
      useAi: withAi,
      onPlan: (n) => job.addTotal(n),
      onStep: () => job.tick(),
    });

    job.setStage(isTypesafeConfigured() ? "Judging relevance with Jev" : "Judging relevance");
    job.addTotal(candidates.length);
    let ticked = 0;
    const context = await relevanceContext(workspaceId, appId, country);
    const relevance = await scoreRelevance(workspaceId, appId, candidates.map((c) => c.term), country, {
      context,
      onProgress: (done) => {
        job.tick(done - ticked);
        ticked = done;
      },
    });
    const scores = relevance.scores;
    const kept = candidates.filter((c) => isRelevant(scores.get(c.term)));
    const filtered = candidates
      .filter((c) => !isRelevant(scores.get(c.term)))
      .map((c) => toFiltered(c, scores.get(c.term)!))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, MAX_FILTERED);

    const picked = [...kept].sort(byRelevance(scores)).slice(0, MAX_SCORED);
    job.setStage("Scoring top keywords");
    job.addTotal(picked.length);
    const scored: Suggestion[] = [];
    await mapLimit(picked, 3, async (c) => {
      try {
        const analysis = await analyzeCached(c.term, country, app.trackId);
        if (analysis.resultsCount > 0) scored.push(toSuggestion(analysis, c.sources, scores.get(c.term)));
        job.setPartial(scored.length);
      } catch {
        job.setPartial(scored.length);
      }
      job.tick();
    });
    const sources = new Set(candidates.map((c) => scores.get(c.term)?.source));
    const result: SuggestionsResult = {
      appId,
      country,
      generatedAt: new Date().toISOString(),
      usedAi,
      aiError,
      candidatesConsidered: candidates.length,
      judged: candidates.length,
      kept: kept.length,
      relevanceSource: sources.size > 1 ? "mixed" : sources.has("jev") ? "jev" : "heuristic",
      relevanceError: relevance.jevError,
      filtered,
      suggestions: scored.sort((a, b) => (b.score ?? b.opportunity) - (a.score ?? a.opportunity) || b.opportunity - a.opportunity),
    };
    await cacheSet(lastKey(workspaceId, appId, country), result, 30 * DAY);
    return result;
  });
}
