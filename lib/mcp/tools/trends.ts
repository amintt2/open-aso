import { z } from "zod";
import { getTrends } from "@/lib/trends/service";
import { defineTool } from "../define";
import { appId, country } from "./shared";

export const trendsTools = [
  defineTool({
    name: "get_ranking_trends",
    title: "Ranking trends",
    layer: "aso",
    description:
      "Daily ranking trends for an app's tracked keywords over 7, 30, 90 or 365 days, from the daily keyword snapshots (gaps between snapshots are carried forward). Returns KPIs at the start and end of the window (estimated daily search installs; search reach % = estimated search installs on target keywords divided by what ranking #1 on each of them would bring, where target keywords are the tracked keywords found in the app's title, subtitle or keyword field; average position of ranked keywords; keywords in the top 10 and top 3), the daily series with rank distribution (top 3, 4–10, 11–50, 51–200, unranked), per-country search installs, reach, top-10 count and best keyword, whatMovedIt (the keywords whose estimated installs changed most over the window, with position before and after), biggest position gainers/losers and popularity/difficulty movers, and app version releases in the window. Keywords judged unrelated or brand are excluded unless includeUnrelated is true. Installs and search reach are modelled estimates.",
    input: {
      appId,
      country: country.optional().describe("Two-letter storefront code. Omit for all tracked countries."),
      days: z.union([z.literal(7), z.literal(30), z.literal(90), z.literal(365)]).default(30).describe("Window in days: 7, 30, 90 or 365 (default 30)"),
      includeUnrelated: z.boolean().default(false).describe("Include keywords judged unrelated or brand in the index (default false)"),
    },
    run: async (a, { workspaceId }) => {
      const r = await getTrends(workspaceId, a.appId, { country: a.country ?? "all", days: a.days, includeAll: a.includeUnrelated });
      const mover = (m: (typeof r.movers.gainers)[number]) => ({
        term: m.term,
        country: m.country,
        startPosition: m.startPosition,
        endPosition: m.endPosition,
        positionChange: m.positionChange,
        popularityChange: m.popularityChange,
        difficultyChange: m.difficultyChange,
      });
      const kpi = (k: NonNullable<typeof r.kpis.end>) => ({
        date: k.date,
        estSearchInstalls: k.installs,
        searchReach: k.reach,
        avgPosition: k.avgPosition,
        top10: k.top10,
        top3: k.top3,
        tracked: k.tracked,
      });
      return {
        note: "Search installs and search reach are modelled estimates, not Apple data. searchReach is a percentage computed only on target keywords (present in the app metadata). Unranked = not in the top 200 (counted as position 201 for changes).",
        window: { from: r.from, to: r.to, days: r.days, country: r.country },
        keywords: r.keywords.length,
        excludedUnrelatedOrBrand: r.excluded,
        historyDays: r.historyDays,
        enoughHistory: r.historyDays >= 2,
        targetKeywords: r.kpis.end?.targets ?? 0,
        kpis: {
          start: r.kpis.start && kpi(r.kpis.start),
          end: r.kpis.end && kpi(r.kpis.end),
        },
        daily: r.points
          .filter((p) => p.tracked > 0)
          .map((p) => ({
            date: p.date,
            estSearchInstalls: p.installs,
            searchReach: p.reach,
            avgPosition: p.avgPosition,
            top10Share: p.top10Share,
            distribution: { top3: p.top3, top4to10: p.top10, top11to50: p.top50, top51to200: p.top200, unranked: p.unranked },
          })),
        countries: r.countries.map((c) => ({
          country: c.country,
          keywords: c.keywords,
          targetKeywords: c.targets,
          estSearchInstalls: c.installs,
          estSearchInstallsStart: c.installsStart,
          searchReach: c.reach,
          searchReachStart: c.reachStart,
          top10: c.top10,
          bestKeyword: c.bestKeyword && { term: c.bestKeyword.term, position: c.bestKeyword.position, estSearchInstalls: c.bestKeyword.installs },
        })),
        whatMovedIt: r.contributors.map((c) => ({
          term: c.term,
          country: c.country,
          inMetadata: c.target,
          startPosition: c.startPosition,
          endPosition: c.endPosition,
          popularity: c.popularity,
          estSearchInstallsChange: c.installsChange,
        })),
        movers: {
          gainers: r.movers.gainers.map(mover),
          losers: r.movers.losers.map(mover),
          popularity: r.movers.popularity.map(mover),
          difficulty: r.movers.difficulty.map(mover),
        },
        versions: r.versions.map((v) => ({ version: v.version, date: v.date })),
      };
    },
  }),
];
