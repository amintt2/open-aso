import { topCharts } from "@/lib/explore/store";
import { countryParam } from "@/lib/explore/params";
import { json, route } from "@/lib/server/http";

export const GET = route(async (req) => {
  const kind = new URL(req.url).searchParams.get("kind") === "paid" ? "paid" : "free";
  return json(await topCharts(countryParam(req), kind));
});
