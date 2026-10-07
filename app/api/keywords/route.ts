import { z } from "zod";
import { setKeywordsLiked } from "@/lib/aso/keywords";
import { requireWorkspace } from "@/lib/server/context";
import { body, json, route } from "@/lib/server/http";

export const PATCH = route(async (req) => {
  const { workspaceId } = await requireWorkspace();
  const input = await body(req, z.object({ ids: z.array(z.number().int()).min(1).max(1000), liked: z.boolean() }));
  await setKeywordsLiked(workspaceId, input.ids, input.liked);
  return json({ ok: true });
});
