import { listProducts } from "@/lib/asc/pricing";
import { requireWorkspace } from "@/lib/server/context";
import { idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  const id = await idParam(params);
  return json(await listProducts(workspaceId, id, { refresh: new URL(req.url).searchParams.get("refresh") === "1" }));
});
