import { exploreSearch } from "@/lib/explore/store";
import { countryParam } from "@/lib/explore/params";
import { HttpError, json, route } from "@/lib/server/http";

export const GET = route(async (req) => {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) throw new HttpError(400, "q is required");
  return json(await exploreSearch(q, countryParam(req)));
});
