import { getInsightsSummary } from "@/lib/dashboard/overview";
import { countryParam } from "@/lib/dashboard/params";
import { requireWorkspace } from "@/lib/server/context";
import { idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  const appId = await idParam(params);
  return json(await getInsightsSummary(workspaceId, appId, countryParam(req)));
});
