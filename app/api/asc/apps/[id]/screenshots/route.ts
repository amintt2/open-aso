import { getScreenshots } from "@/lib/asc/metadata";
import { requireWorkspace } from "@/lib/server/context";
import { HttpError, idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  const id = await idParam(params);
  const search = new URL(req.url).searchParams;
  const locale = search.get("locale");
  if (!locale) throw new HttpError(400, "locale is required");
  return json(await getScreenshots(workspaceId, id, locale, { refresh: search.get("refresh") === "1" }));
});
