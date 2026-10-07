import { analyzeKeyword, type KeywordAnalysis } from "@/lib/aso/analyze";
import { getApp } from "@/lib/aso/apps";
import { listKeywords } from "@/lib/aso/keywords";
import { cached, cacheGet, cacheSet, DAY, HOUR } from "@/lib/server/cache";
import { db } from "@/lib/server/db";
import { HttpError } from "@/lib/server/http";
import { aiAvailable } from "./ai";
import { generateCandidates } from "./generate";
import { findRunningJob, mapLimit, publicJob, startJob, type JobState } from "./jobs";
import type { Suggestion, SuggestionsOverview, SuggestionsResult } from "./types";

export const MIN_TRACKED = 3;
const MAX_SCORED = 40;
const JOB_KIND = "suggestions";

function lastKey(appId: number, country: string) {
  return `suggestions:last:${appId}:${country}`;
}

function jobKey(appId: number, country: string) {
  return `${appId}:${country}`;
}

export function competitorNames(appId: number): string[] {
  return (db().prepare("SELECT name FROM competitors WHERE app_id = ?").all(appId) as { name: string }[]).map((r) => r.name);
}

export function analyzeCached(term: string, country: string, trackId: number): Promise<KeywordAnalysis> {
  return cached(`suggestions:analysis:${country}:${trackId}:${term}`, 12 * HOUR, () => analyzeKeyword(term, country, trackId));
}

function toSuggestion(a: KeywordAnalysis, sources: Suggestion["sources"]): Suggestion {
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
  };
}

export function suggestionsOverview(appId: number, country: string): SuggestionsOverview {
  getApp(appId);
  const running = findRunningJob<SuggestionsResult>(JOB_KIND, jobKey(appId, country));
  return {
    last: cacheGet<SuggestionsResult>(lastKey(appId, country)) ?? null,
    running: running ? publicJob(running) : null,
    aiAvailable: aiAvailable(),
    trackedCount: listKeywords(appId, country).length,
  };
}

export function startSuggestions(appId: number, country: string, useAi: boolean): JobState<SuggestionsResult> {
  const app = getApp(appId);
  const tracked = listKeywords(appId, country);
  if (tracked.length < MIN_TRACKED) throw new HttpError(400, `Add at least ${MIN_TRACKED} keywords in this country to unlock suggestions`);
  const withAi = useAi && aiAvailable();

  return startJob<SuggestionsResult>(JOB_KIND, jobKey(appId, country), async (job) => {
    job.setStage("Collecting ideas", 0);
    const { candidates, aiError, usedAi } = await generateCandidates({
      app,
      country,
      tracked,
      competitors: competitorNames(appId),
      useAi: withAi,
      onPlan: (n) => job.addTotal(n),
      onStep: () => job.tick(),
    });
    const picked = candidates.slice(0, MAX_SCORED);
    job.setStage("Scoring keywords");
    job.addTotal(picked.length);
    const scored: Suggestion[] = [];
    await mapLimit(picked, 3, async (c) => {
      try {
        const analysis = await analyzeCached(c.term, country, app.trackId);
        if (analysis.resultsCount > 0) scored.push(toSuggestion(analysis, c.sources));
        job.setPartial(scored.length);
      } catch {
        job.setPartial(scored.length);
      }
      job.tick();
    });
    const result: SuggestionsResult = {
      appId,
      country,
      generatedAt: new Date().toISOString(),
      usedAi,
      aiError,
      candidatesConsidered: candidates.length,
      suggestions: scored.sort((a, b) => b.opportunity - a.opportunity),
    };
    cacheSet(lastKey(appId, country), result, 30 * DAY);
    return result;
  });
}
