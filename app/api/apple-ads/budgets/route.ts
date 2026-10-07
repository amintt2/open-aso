import { z } from "zod";
import { body, json } from "@/lib/server/http";
import { updateBudgets } from "@/lib/apple-ads/service";
import { adsRoute, idString, writeFlags } from "@/lib/apple-ads/http";

export const POST = adsRoute(async (req) => {
  const input = await body(
    req,
    z.object({ changes: z.array(z.object({ campaignId: idString, dailyBudget: z.number().positive().max(1_000_000) })).min(1).max(200), enforceCaps: z.boolean().optional(), ...writeFlags }),
  );
  return json(await updateBudgets(input.changes, input));
});
