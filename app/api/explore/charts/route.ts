import { topCharts } from "@/lib/explore/store";
import { countryParam } from "@/lib/explore/params";
import { requireWorkspace } from "@/lib/server/context";
import { json, route } from "@/lib/server/http";

export const GET = route(async (req) => {
  await requireWorkspace();
  const kind = new URL(req.url).searchParams.get("kind") === "paid" ? "paid" : "free";
  return json(await topCharts(countryParam(req), kind));
});
