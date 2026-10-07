import { getApp } from "@/lib/aso/apps";
import { positionSeries } from "@/lib/keywords/history";
import { HttpError, json, route } from "@/lib/server/http";

export const GET = route(async (req) => {
  const params = new URL(req.url).searchParams;
  const appId = Number(params.get("appId"));
  if (!Number.isInteger(appId) || appId <= 0)
    throw new HttpError(400, "appId is required");
  const country = (params.get("country") ?? "").toLowerCase();
  if (country.length !== 2) throw new HttpError(400, "country is required");
  const days = Math.min(
    365,
    Math.max(2, Math.round(Number(params.get("days") ?? 30)) || 30),
  );
  getApp(appId);
  return json(positionSeries(appId, country, days));
});
