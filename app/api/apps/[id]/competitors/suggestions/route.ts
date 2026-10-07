import { suggestCompetitors } from "@/lib/competitors/competitors";
import { getApp } from "@/lib/aso/apps";
import { requireWorkspace } from "@/lib/server/context";
import { idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  const appId = await idParam(params);
  const country = new URL(req.url).searchParams.get("country") ?? (await getApp(workspaceId, appId)).primaryCountry;
  return json(await suggestCompetitors(workspaceId, appId, country));
});
