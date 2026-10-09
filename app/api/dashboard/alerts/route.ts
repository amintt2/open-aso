import { getHomeAlerts } from "@/lib/dashboard/home";
import { requireWorkspace } from "@/lib/server/context";
import { json, route } from "@/lib/server/http";

export const GET = route(async () => {
  const { workspaceId } = await requireWorkspace();
  return json(await getHomeAlerts(workspaceId));
});
