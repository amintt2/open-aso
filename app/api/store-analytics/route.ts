import { getStoreAnalytics, storeDays } from "@/lib/asc/analytics/service";
import { requireWorkspace } from "@/lib/server/context";
import { HttpError, json, route } from "@/lib/server/http";

const DEMO = ["never", "auto", "only"] as const;

export const GET = route(async (req) => {
  const { workspaceId } = await requireWorkspace();
  const params = new URL(req.url).searchParams;
  const appId = Number(params.get("appId"));
  if (!Number.isInteger(appId) || appId <= 0) throw new HttpError(400, "appId is required");
  const country = params.get("country")?.trim().toLowerCase() || "all";
  if (country !== "all" && !/^[a-z]{2}$/.test(country)) throw new HttpError(400, "country must be a two-letter code or all");
  const demo = DEMO.find((d) => d === params.get("demo")) ?? "never";
  return json(await getStoreAnalytics(workspaceId, appId, { days: storeDays(params.get("days")), country, demo }));
});
