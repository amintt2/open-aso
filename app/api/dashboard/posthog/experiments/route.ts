import { getApp } from "@/lib/aso/apps";
import { optionalAppId } from "@/lib/dashboard/params";
import { getPosthogExperimentResults } from "@/lib/dashboard/posthog";
import { requireWorkspace } from "@/lib/server/context";
import { json, route } from "@/lib/server/http";

export const GET = route(async (req) => {
  const { workspaceId } = await requireWorkspace();
  const appId = optionalAppId(req);
  if (appId) await getApp(workspaceId, appId);
  const limit = Number(new URL(req.url).searchParams.get("limit"));
  return json(
    await getPosthogExperimentResults(
      workspaceId,
      appId,
      Number.isInteger(limit) && limit > 0 && limit <= 50 ? limit : null,
    ),
  );
});
