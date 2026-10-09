import { getApp } from "@/lib/aso/apps";
import { optionalAppId } from "@/lib/dashboard/params";
import { getPosthogLive } from "@/lib/dashboard/posthog";
import { requireWorkspace } from "@/lib/server/context";
import { json, route } from "@/lib/server/http";

export const GET = route(async (req) => {
  const { workspaceId } = await requireWorkspace();
  const appId = optionalAppId(req);
  if (appId) await getApp(workspaceId, appId);
  return json(await getPosthogLive(workspaceId, appId));
});
