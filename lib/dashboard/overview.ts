import { getApp } from "@/lib/aso/apps";
import { listKeywords } from "@/lib/aso/keywords";
import { getConnection, getDashboard } from "@/lib/apple-ads/service";
import { fetchReviews } from "@/lib/appstore/itunes";
import { getKeywordImpact } from "@/lib/impact/service";
import { metadataInsights } from "@/lib/insights/metadata";
import { lastScan } from "@/lib/opportunities/scan";
import { cached, wsKey } from "@/lib/server/cache";
import { dailySearchInstalls } from "@/lib/trends/compute";
import { getTrends } from "@/lib/trends/service";
import { observedPeriods } from "./home";
import { averagePeriod, periodOf, WINDOW_DAYS } from "./trends";
import type {
  AdsSummary,
  ImpactSummary,
  InsightsSummary,
  OpportunitiesSummary,
  OverviewSummary,
  ReviewsSummary,
  TopKeyword,
} from "./types";

const TTL = 5 * 60 * 1000;

const key = (workspaceId: string, appId: number, name: string) =>
  wsKey(workspaceId, `dashboard:app:${appId}:${name}`);

export function getOverviewSummary(
  workspaceId: string,
  appId: number,
  country: string,
): Promise<OverviewSummary> {
  return cached(
    key(workspaceId, appId, `summary:${country}`),
    TTL,
    async () => {
      const app = await getApp(workspaceId, appId);
      const [trends, observed] = await Promise.all([
        app.keywordCount
          ? getTrends(workspaceId, appId, { country, days: WINDOW_DAYS }).catch(
              () => null,
            )
          : Promise.resolve(null),
        observedPeriods(workspaceId, 7, appId),
      ]);
      const points = trends?.points ?? [];
      const s = app.store;
      return {
        app: {
          id: app.id,
          name: app.name,
          subtitle: app.subtitle,
          iconUrl: app.iconUrl,
          developer: app.developer,
          rating: s.averageUserRating ?? null,
          ratingCount: s.userRatingCount ?? null,
          version: s.version ?? null,
          versionDate: s.currentVersionReleaseDate ?? null,
          genre: s.primaryGenreName ?? null,
          primaryCountry: app.primaryCountry,
          countries: app.countries,
          keywordCount: app.keywordCount,
          url: s.trackViewUrl ?? null,
        },
        country,
        visibility: periodOf(points, (p) => (p.tracked ? p.visibility : null)),
        avgPosition: periodOf(points, (p) =>
          p.tracked ? p.avgPosition : null,
        ),
        top10: periodOf(points, (p) => (p.tracked ? p.top3 + p.top10 : null)),
        top3: periodOf(points, (p) => (p.tracked ? p.top3 : null)),
        searchInstalls: averagePeriod(points, (p) => p.installs),
        installs: observed.installs,
        revenue: observed.revenue,
      };
    },
  );
}

export function getTopKeywords(
  workspaceId: string,
  appId: number,
  country: string,
  limit = 8,
): Promise<TopKeyword[]> {
  return cached(
    key(workspaceId, appId, `keywords:${country}`),
    TTL,
    async () => {
      const list = await listKeywords(
        workspaceId,
        appId,
        country === "all" ? undefined : country,
      );
      return list
        .map((k) => ({
          id: k.id,
          term: k.term,
          country: k.country,
          position: k.position,
          positionChange: k.positionChange,
          popularity: k.popularity,
          popularitySource: k.popularitySource,
          relevance: k.relevance,
          relevanceCategory: k.relevanceCategory,
          languageMatch: k.languageMatch,
          estInstalls:
            Math.round(
              dailySearchInstalls(k.popularity, k.country, k.position) * 10,
            ) / 10,
        }))
        .sort(
          (a, b) =>
            b.estInstalls - a.estInstalls ||
            (b.popularity ?? -1) - (a.popularity ?? -1) ||
            (a.position ?? 999) - (b.position ?? 999),
        )
        .slice(0, limit);
    },
  );
}

export function getImpactSummary(
  workspaceId: string,
  appId: number,
  country: string,
): Promise<ImpactSummary> {
  return cached(key(workspaceId, appId, `impact:${country}`), TTL, async () => {
    const r = await getKeywordImpact(workspaceId, appId, {
      country,
      days: 30,
      demo: "auto",
    });
    const keywords = [...r.keywords]
      .sort(
        (a, b) =>
          (b.estRevenue ?? 0) - (a.estRevenue ?? 0) ||
          b.estDownloads - a.estDownloads,
      )
      .slice(0, 5)
      .map((k) => ({
        key: k.key,
        term: k.term,
        country: k.country,
        position: k.position,
        estDownloads: k.estDownloads,
        estRevenue: k.estRevenue,
      }));
    return {
      demo: r.demo,
      calibrated: r.calibrated,
      revenueAvailable: r.revenueAvailable,
      days: r.days,
      keywords,
      totalExplained: r.totals.explained,
    };
  });
}

export function getInsightsSummary(
  workspaceId: string,
  appId: number,
  country: string,
): Promise<InsightsSummary> {
  return cached(
    key(workspaceId, appId, `insights:${country}`),
    TTL,
    async () => {
      const app = await getApp(workspaceId, appId);
      const c = country === "all" ? app.primaryCountry : country;
      const r = await metadataInsights(workspaceId, appId, c);
      const actionable = r.insights.filter((i) => i.severity !== "positive");
      return {
        country: c,
        total: actionable.length,
        insights: actionable.slice(0, 3),
      };
    },
  );
}

export function getAdsSummary(
  workspaceId: string,
  appId: number,
): Promise<AdsSummary> {
  return cached(key(workspaceId, appId, "ads"), TTL, async () => {
    const app = await getApp(workspaceId, appId);
    const connection = await getConnection(workspaceId);
    if (!connection.connected)
      return connection.configured && connection.lastError
        ? { state: "error", message: connection.lastError }
        : { state: "disconnected" };
    try {
      const d = await getDashboard(workspaceId, { days: 7 });
      const campaigns = d.campaigns.filter((c) => c.adamId === app.trackId);
      if (!campaigns.length) return { state: "no-campaigns", demo: d.demo };
      const spend = campaigns.reduce((s, c) => s + c.metrics.spend, 0);
      const installs = campaigns.reduce((s, c) => s + c.metrics.installs, 0);
      const attributed = campaigns
        .map((c) => c.attribution)
        .filter((a) => a != null);
      const revenue = attributed.reduce((s, a) => s + a.revenue, 0);
      return {
        state: "ok",
        demo: d.demo,
        currency: d.currency,
        spend,
        installs,
        cpa: installs > 0 ? spend / installs : null,
        roas: attributed.length && spend > 0 ? revenue / spend : null,
        campaigns: campaigns.length,
        previousSpend: null,
      };
    } catch (error) {
      return {
        state: "error",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

export function getReviewsSummary(
  workspaceId: string,
  appId: number,
  country: string,
): Promise<ReviewsSummary> {
  return cached(
    key(workspaceId, appId, `reviews:${country}`),
    TTL,
    async () => {
      const app = await getApp(workspaceId, appId);
      const c = country === "all" ? app.primaryCountry : country;
      const reviews = await fetchReviews(app.trackId, c, 1).catch(() => []);
      const recent = reviews.slice(0, 50);
      return {
        country: c,
        storeRating: app.store.averageUserRating ?? null,
        storeCount: app.store.userRatingCount ?? null,
        recentAverage: recent.length
          ? Math.round(
              (recent.reduce((s, r) => s + r.rating, 0) / recent.length) * 100,
            ) / 100
          : null,
        recentCount: recent.length,
        latest: recent.slice(0, 2),
      };
    },
  );
}

export async function getOpportunitiesSummary(
  workspaceId: string,
  appId: number,
): Promise<OpportunitiesSummary> {
  const { last } = await lastScan(workspaceId, appId);
  if (!last) return { term: null, scannedAt: null, top: [] };
  return {
    term: last.term,
    scannedAt: last.scannedAt,
    top: last.results
      .filter((r) => !r.error)
      .sort((a, b) => b.opportunity - a.opportunity)
      .slice(0, 3),
  };
}
