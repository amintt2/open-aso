import { getAdsSummary } from "@/lib/dashboard/overview";
import { requireWorkspace } from "@/lib/server/context";
import { idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  const appId = await idParam(params);
  return json(await getAdsSummary(workspaceId, appId));
});
