import { getGeography, getKeywordRoas, getKeywordTrend, getOverview, getRetention, getSources, periodDays, type AnalyticsQuery } from "@/lib/analytics/queries";
import { HttpError, json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const VIEWS = {
  overview: getOverview,
  sources: getSources,
  geography: getGeography,
  retention: getRetention,
  keywords: getKeywordRoas,
} as const;

export const GET = route(async (req, { params }: { params: Promise<{ view: string }> }) => {
  const { view } = await params;
  const search = new URL(req.url).searchParams;
  const appId = Number(search.get("appId"));
  const demo = search.get("demo");
  const query: AnalyticsQuery = {
    appId: Number.isInteger(appId) && appId > 0 ? appId : null,
    days: periodDays(search.get("days")),
    includeSandbox: search.get("sandbox") === "1",
    demo: demo === "only" || demo === "never" ? demo : "auto",
  };
  if (view === "trend") {
    const keywordId = search.get("keywordId");
    if (!keywordId) throw new HttpError(400, "keywordId is required");
    return json(getKeywordTrend(keywordId, query));
  }
  const handler = VIEWS[view as keyof typeof VIEWS];
  if (!handler) throw new HttpError(404, "Unknown analytics view");
  return json(handler(query));
});
