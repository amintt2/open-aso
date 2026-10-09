import { getRevenueChart } from "@/lib/dashboard/home";
import { daysParam } from "@/lib/dashboard/params";
import { requireWorkspace } from "@/lib/server/context";
import { json, route } from "@/lib/server/http";

export const GET = route(async (req) => {
  const { workspaceId } = await requireWorkspace();
  return json(await getRevenueChart(workspaceId, daysParam(req)));
});
