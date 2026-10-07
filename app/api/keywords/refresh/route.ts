import { z } from "zod";
import { refreshKeywords } from "@/lib/aso/keywords";
import { body, json, route } from "@/lib/server/http";

export const POST = route(async (req) => {
  const input = await body(req, z.object({ ids: z.array(z.number().int()).min(1).max(500) }));
  const results = await refreshKeywords(input.ids);
  return json({ results, failed: results.filter((r) => !r.ok).length });
});
