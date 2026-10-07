import { json } from "@/lib/server/http";
import { requireWorkspace } from "@/lib/server/context";
import { testConnection } from "@/lib/apple-ads/connection";
import { adsRoute } from "@/lib/apple-ads/http";

export const POST = adsRoute(async () => {
  const { workspaceId } = await requireWorkspace("admin");
  return json(await testConnection(workspaceId));
});
