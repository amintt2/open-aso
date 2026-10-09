import { getStoreSummary } from "@/lib/asc/analytics/service";
import { optionalAppId } from "@/lib/dashboard/params";
import { requireWorkspace } from "@/lib/server/context";
import { json, route } from "@/lib/server/http";

export const GET = route(async (req) => {
  const { workspaceId } = await requireWorkspace();
  return json(await getStoreSummary(workspaceId, optionalAppId(req)));
});
