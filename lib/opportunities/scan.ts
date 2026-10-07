import { isCountry } from "@/lib/appstore/countries";
import { analyzeKeyword } from "@/lib/aso/analyze";
import { getApp } from "@/lib/aso/apps";
import { marketSize, normalizeTerm } from "@/lib/aso/scoring";
import { cached, cacheGet, cacheSet, DAY } from "@/lib/server/cache";
import { HttpError } from "@/lib/server/http";
import { findRunningJob, mapLimit, publicJob, startJob, type JobState } from "@/lib/suggestions/jobs";
import type { JobView } from "@/lib/suggestions/types";
import type { CountryOpportunity, OpportunityScan } from "./types";

const JOB_KIND = "opportunities";

function lastKey(appId: number) {
  return `opportunities:last:${appId}`;
}

function scanCountry(term: string, country: string, trackId: number): Promise<CountryOpportunity> {
  return cached(`opportunities:v1:${country}:${trackId}:${term}`, DAY, async () => {
    const a = await analyzeKeyword(term, country, trackId);
    if (a.resultsCount === 0) throw new Error("The App Store returned no results here. Try again later.");
    const top = a.topApps[0];
    return {
      country,
      popularity: a.popularity,
      difficulty: a.difficulty,
      opportunity: a.opportunity,
      label: a.label,
      position: a.position,
      monthlySearches: a.monthlySearches,
      downloadsEst: a.downloadsEst,
      resultsCount: a.resultsCount,
      topApp: top ? { trackId: top.trackId, name: top.name, iconUrl: top.iconUrl, developer: top.developer } : null,
    };
  });
}

export function lastScan(appId: number): { last: OpportunityScan | null; running: JobView<OpportunityScan> | null } {
  getApp(appId);
  const job = findRunningJob<OpportunityScan>(JOB_KIND, (key) => key.startsWith(`${appId}:`));
  return { last: cacheGet<OpportunityScan>(lastKey(appId)) ?? null, running: job ? publicJob(job) : null };
}

export function startScan(appId: number, rawTerm: string, rawCountries: string[]): JobState<OpportunityScan> {
  const app = getApp(appId);
  const term = normalizeTerm(rawTerm);
  if (!term) throw new HttpError(400, "Enter a keyword to scan");
  const countries = [...new Set(rawCountries.map((c) => c.toLowerCase()).filter(isCountry))].sort((a, b) => marketSize(b) - marketSize(a));
  if (!countries.length) throw new HttpError(400, "Pick at least one country");
  const key = `${appId}:${term}:${[...countries].sort().join(",")}`;

  return startJob<OpportunityScan>(JOB_KIND, key, async (job) => {
    job.setStage(`Scanning ${countries.length} ${countries.length === 1 ? "country" : "countries"}`, countries.length);
    const results: CountryOpportunity[] = [];
    await mapLimit(countries, 4, async (country) => {
      try {
        results.push(await scanCountry(term, country, app.trackId));
      } catch (error) {
        results.push({
          country,
          popularity: 0,
          difficulty: 0,
          opportunity: 0,
          label: "Low Volume",
          position: null,
          monthlySearches: 0,
          downloadsEst: 0,
          resultsCount: 0,
          topApp: null,
          error: error instanceof Error ? error.message : "Scan failed",
        });
      }
      job.setPartial([...results]);
      job.tick();
    });
    const scan: OpportunityScan = {
      appId,
      term,
      countries,
      scannedAt: new Date().toISOString(),
      results: results.sort((a, b) => b.opportunity - a.opportunity),
    };
    cacheSet(lastKey(appId), scan, 30 * DAY);
    return scan;
  });
}
