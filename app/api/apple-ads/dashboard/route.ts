import { json } from "@/lib/server/http";
import { requireWorkspace } from "@/lib/server/context";
import { getDashboard } from "@/lib/apple-ads/service";
import { adsRoute, searchOpts } from "@/lib/apple-ads/http";

export const GET = adsRoute(async (req) => {
  const { workspaceId } = await requireWorkspace();
  return json(await getDashboard(workspaceId, searchOpts(req)));
});
