import { getApp, listVersions } from "@/lib/aso/apps";
import { getKeyword, keywordHistory } from "@/lib/aso/keywords";
import { requireWorkspace } from "@/lib/server/context";
import { idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  const id = await idParam(params);
  const kw = await getKeyword(workspaceId, id);
  const app = await getApp(workspaceId, kw.appId);
  return json({ history: await keywordHistory(workspaceId, id), versions: await listVersions(app.trackId) });
});
