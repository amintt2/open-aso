import { z } from "zod";
import { getKeywordImpact } from "@/lib/impact/service";
import { defineTool } from "../define";
import { appId, country } from "./shared";

const round = (n: number | null, digits = 1) => (n == null ? null : Math.round(n * 10 ** digits) / 10 ** digits);

export const impactTools = [
  defineTool({
    name: "get_keyword_impact",
    title: "Keyword impact",
    layer: "analytics",
    description:
      "Modelled estimate of how many downloads and how much revenue each tracked keyword brings, per country. Calibrated on observed installs (PostHog new users, else Open ASO SDK installs) minus Apple Ads installs; organic search share is split across keywords by popularity and daily rank, revenue uses observed ARPU per country. Returns per-country totals (observed, paid, organic, explained by tracked keywords, unexplained search, browse), keyword rows with confidence, and which data sources were used. Without any connected data it returns an uncalibrated estimate (demo: \"never\", default) or synthetic demo data (demo: \"only\").",
    input: {
      appId,
      country: country.optional().describe("Two-letter storefront code. Omit for all tracked countries."),
      days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30).describe("Window in days: 7, 30 or 90 (default 30)"),
      liveOnly: z.boolean().default(false).describe("Only keywords ranked in the top 50 or with Apple Ads installs"),
      demo: z.enum(["never", "auto", "only"]).default("never").describe("never = real data only (default), auto = demo data when nothing is connected, only = demo data"),
    },
    run: async (a, { workspaceId }) => {
      const r = await getKeywordImpact(workspaceId, a.appId, { country: a.country ?? "all", days: a.days, demo: a.demo });
      return {
        note: "All per-keyword downloads and revenue are modelled estimates, not Apple data.",
        demo: r.demo,
        calibrated: r.calibrated,
        window: { from: r.from, to: r.to, days: r.days },
        searchShare: r.searchShare,
        dataSources: r.dataSources,
        totals: r.totals,
        otherCountries: r.otherCountries,
        countries: r.countries,
        keywords: r.keywords
          .filter((k) => !a.liveOnly || k.live)
          .map((k) => ({
            term: k.term,
            country: k.country,
            position: k.position,
            popularity: k.popularity,
            popularitySource: k.popularitySource,
            estDownloads: round(k.estDownloads),
            estPerDay: round(k.estPerDay, 2),
            shareOfSearch: round(k.shareOfSearch, 3),
            estRevenue: round(k.estRevenue, 2),
            paidInstalls: k.paidInstalls,
            paidRevenue: round(k.paidRevenue, 2),
            paidRevenueSource: k.paidRevenueSource,
            confidence: k.confidence,
            confidenceReasons: k.confidenceReasons,
            live: k.live,
          })),
      };
    },
  }),
];
