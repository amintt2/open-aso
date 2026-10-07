import { refreshAppStoreData } from "@/lib/aso/apps";
import { requireWorkspace } from "@/lib/server/context";
import { idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (_req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  return json(await refreshAppStoreData(workspaceId, await idParam(params)));
});
