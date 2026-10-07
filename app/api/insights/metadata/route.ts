import { isCountry } from "@/lib/appstore/countries";
import { metadataInsights } from "@/lib/insights/metadata";
import { HttpError, json, route } from "@/lib/server/http";

export const GET = route(async (req) => {
  const params = new URL(req.url).searchParams;
  const appId = Number(params.get("appId"));
  if (!Number.isInteger(appId) || appId <= 0) throw new HttpError(400, "appId is required");
  const country = (params.get("country") ?? "").toLowerCase();
  if (!isCountry(country)) throw new HttpError(400, "Unsupported country");
  return json(metadataInsights(appId, country));
});
