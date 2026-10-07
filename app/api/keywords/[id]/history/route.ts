import { getApp, listVersions } from "@/lib/aso/apps";
import { getKeyword, keywordHistory } from "@/lib/aso/keywords";
import { idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const id = await idParam(params);
  const kw = getKeyword(id);
  const app = getApp(kw.appId);
  return json({ history: keywordHistory(id), versions: listVersions(app.trackId) });
});
