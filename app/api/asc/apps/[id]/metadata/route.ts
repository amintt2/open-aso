import { getAppMetadata, getMetadata } from "@/lib/asc/metadata";
import { requireWorkspace } from "@/lib/server/context";
import { idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  const id = await idParam(params);
  const search = new URL(req.url).searchParams;
  const locale = search.get("locale");
  if (locale) return json(await getMetadata(workspaceId, id, locale));
  return json(await getAppMetadata(workspaceId, id, { refresh: search.get("refresh") === "1" }));
});
