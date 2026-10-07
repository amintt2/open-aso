import { z } from "zod";
import { refreshKeywords } from "@/lib/aso/keywords";
import { requireWorkspace } from "@/lib/server/context";
import { body, json, route } from "@/lib/server/http";

export const POST = route(async (req) => {
  const { workspaceId } = await requireWorkspace();
  const input = await body(req, z.object({ ids: z.array(z.number().int()).min(1).max(500) }));
  const results = await refreshKeywords(workspaceId, input.ids);
  return json({ results, failed: results.filter((r) => !r.ok).length });
});
