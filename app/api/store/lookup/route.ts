import { isCountry } from "@/lib/appstore/countries";
import { lookupApps } from "@/lib/appstore/itunes";
import { requireUser } from "@/lib/server/context";
import { HttpError, json, route } from "@/lib/server/http";

export const GET = route(async (req) => {
  await requireUser();
  const params = new URL(req.url).searchParams;
  const ids = (params.get("ids") ?? params.get("id") ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 100);
  if (!ids.length) throw new HttpError(400, "ids is required");
  const country = (params.get("country") ?? "us").toLowerCase();
  if (!isCountry(country)) throw new HttpError(400, "Unsupported country");
  return json(await lookupApps(ids, country));
});
