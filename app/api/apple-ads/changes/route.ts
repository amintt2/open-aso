import { json } from "@/lib/server/http";
import { requireWorkspace } from "@/lib/server/context";
import { recentChanges } from "@/lib/apple-ads/prefs";
import { adsRoute } from "@/lib/apple-ads/http";

export const GET = adsRoute(async () => {
  const { workspaceId } = await requireWorkspace();
  return json(await recentChanges(workspaceId, 100));
});
