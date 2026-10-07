import { analyzeKeyword, type KeywordAnalysis } from "@/lib/aso/analyze";
import { getApp } from "@/lib/aso/apps";
import { listKeywords } from "@/lib/aso/keywords";
import { cached, cacheGet, cacheSet, DAY, HOUR, wsKey } from "@/lib/server/cache";
import { db } from "@/lib/server/db";
import { HttpError } from "@/lib/server/http";
import { aiAvailable } from "./ai";
import { generateCandidates } from "./generate";
import { findRunningJob, mapLimit, publicJob, startJob, type JobState } from "./jobs";
import type { Suggestion, SuggestionsOverview, SuggestionsResult } from "./types";

export const MIN_TRACKED = 3;
const MAX_SCORED = 40;
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
    job.setStage("Collecting ideas", 0);
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
    await cacheSet(lastKey(workspaceId, appId, country), result, 30 * DAY);
    return result;
  });
}
