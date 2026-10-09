import { z } from "zod";
import { getStoreAnalytics } from "@/lib/asc/analytics/service";
import { defineTool } from "../define";
import { appId, country } from "./shared";

const pct = (n: number | null | undefined) => (n == null ? null : Math.round(n * 10000) / 100);

export const storeAnalyticsTools = [
  defineTool({
    name: "get_app_store_analytics",
    title: "App Store Analytics (Apple)",
    layer: "analytics",
    description:
      "Apple's own App Store Analytics for an app, imported from App Store Connect Analytics Reports (App Store Discovery and Engagement + App Downloads): impressions, product page views, first-time downloads, redownloads, updates and conversion (first-time downloads ÷ unique impressions, in %), per day, per source type (App Store search, browse, app referrer, web referrer, …) and per territory, with the previous period for comparison. These are Apple-reported numbers, not estimates (Apple applies privacy thresholds, so small rows can be missing). Data lags: Apple publishes yesterday's numbers once a day. Returns status (not_connected, not_linked, not_requested, waiting, error, ok) and data freshness.",
    input: {
      appId,
      days: z.union([z.literal(7), z.literal(30), z.literal(90), z.literal(180)]).default(30).describe("Window in days ending at the latest day Apple has published: 7, 30, 90 or 180 (default 30)"),
      country: country.optional().describe("Two-letter territory code to filter on. Omit for all territories."),
      daily: z.boolean().default(true).describe("Include the daily series (default true)"),
    },
    run: async (a, { workspaceId }) => {
      const r = await getStoreAnalytics(workspaceId, a.appId, { days: a.days, country: a.country ?? "all" });
      return {
        status: r.status,
        message: r.message,
        demo: r.demo,
        window: { from: r.from, to: r.to, days: r.days, country: r.country },
        dataThrough: r.dataThrough,
        freshness: {
          note: "Apple publishes yesterday's numbers once a day (usually early afternoon in Europe).",
          lastCheckAt: r.sync.lastCheckAt,
          nextCheckAt: r.sync.nextCheckAt,
          requestedAt: r.sync.requestedAt,
          historySnapshot: r.sync.snapshot,
        },
        totals: r.totals
          ? {
              impressions: r.totals.impressions,
              impressionsUnique: r.totals.impressionsUnique,
              productPageViews: r.totals.pageViews,
              firstTimeDownloads: r.totals.firstDownloads,
              redownloads: r.totals.redownloads,
              updates: r.totals.updates,
              conversionRatePct: { current: pct(r.totals.conversion.current), previous: pct(r.totals.conversion.previous) },
              pageViewConversionPct: { current: pct(r.totals.pageViewConversion.current), previous: pct(r.totals.pageViewConversion.previous) },
              proceedsUsd: r.totals.proceeds,
            }
          : null,
        sources: r.sources.map((s) => ({
          source: s.source,
          impressions: s.impressions,
          productPageViews: s.pageViews,
          firstTimeDownloads: s.firstDownloads,
          previousFirstTimeDownloads: s.previousFirstDownloads,
          sharePct: pct(s.share),
          conversionPct: pct(s.conversion),
        })),
        territories: r.territories.slice(0, 40).map((t) => ({
          territory: t.territory,
          impressions: t.impressions,
          productPageViews: t.pageViews,
          firstTimeDownloads: t.firstDownloads,
          previousFirstTimeDownloads: t.previousFirstDownloads,
          conversionPct: pct(t.conversion),
          proceedsUsd: t.proceeds,
        })),
        daily: a.daily
          ? r.daily.map((d) => ({
              date: d.date,
              impressions: d.impressions,
              productPageViews: d.pageViews,
              firstTimeDownloads: d.firstDownloads,
              redownloads: d.redownloads,
              conversionPct: pct(d.conversion),
            }))
          : undefined,
      };
    },
  }),
];
