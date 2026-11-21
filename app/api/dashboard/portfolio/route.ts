import { getPortfolio } from "@/lib/dashboard/portfolio";
import { requireWorkspace } from "@/lib/server/context";
import { json, route } from "@/lib/server/http";
import { trafficDays } from "@/lib/traffic/service";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const { workspaceId } = await requireWorkspace();
  const search = new URL(req.url).searchParams;
  return json(await getPortfolio(workspaceId, { days: trafficDays(search.get("days")), demo: search.get("demo") === "1" }));
});
