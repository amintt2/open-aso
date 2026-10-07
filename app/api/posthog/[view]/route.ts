import {
  getPosthogEvents,
  getPosthogExperiments,
  getPosthogFunnel,
  getPosthogGeography,
  getPosthogNewUsers,
  getPosthogOverview,
  getPosthogRetention,
  getPosthogVersions,
  posthogDays,
  type PosthogQuery,
} from "@/lib/posthog/queries";
import { HttpError, json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const VIEWS = {
  overview: getPosthogOverview,
  funnel: getPosthogFunnel,
  retention: getPosthogRetention,
  geography: getPosthogGeography,
  versions: getPosthogVersions,
  experiments: getPosthogExperiments,
  events: getPosthogEvents,
} as const;

export const GET = route(async (req, { params }: { params: Promise<{ view: string }> }) => {
  const { view } = await params;
  const search = new URL(req.url).searchParams;
  const appId = Number(search.get("appId"));
  const demo = search.get("demo");
  const query: PosthogQuery = {
    appId: Number.isInteger(appId) && appId > 0 ? appId : null,
    days: posthogDays(search.get("days")),
    demo: demo && demo !== "0" ? demo : null,
    refresh: search.get("refresh") === "1",
  };
  if (view === "newusers") return json(await getPosthogNewUsers(query, search.get("country")));
  const handler = VIEWS[view as keyof typeof VIEWS];
  if (!handler) throw new HttpError(404, "Unknown PostHog view");
  return json(await handler(query));
});
