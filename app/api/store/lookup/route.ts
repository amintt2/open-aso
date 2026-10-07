import { lookupApps } from "@/lib/appstore/itunes";
import { HttpError, json, route } from "@/lib/server/http";

export const GET = route(async (req) => {
  const params = new URL(req.url).searchParams;
  const ids = (params.get("ids") ?? params.get("id") ?? "").split(",").map(Number).filter(Boolean);
  if (!ids.length) throw new HttpError(400, "ids is required");
  return json(await lookupApps(ids, (params.get("country") ?? "us").toLowerCase()));
});
