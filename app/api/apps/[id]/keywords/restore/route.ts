import { z } from "zod";
import { listKeywords, restoreKeywords } from "@/lib/aso/keywords";
import { requireWorkspace } from "@/lib/server/context";
import { body, idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  const appId = await idParam(params);
  const input = await body(req, z.object({ ids: z.array(z.number().int().positive()).min(1).max(5000) }));
  const archived = new Set((await listKeywords(workspaceId, appId, undefined, { archived: "only" })).map((k) => k.id));
  return json({ restored: await restoreKeywords(workspaceId, input.ids.filter((id) => archived.has(id))) });
});
