import { z } from "zod";
import { body, json } from "@/lib/server/http";
import { requireWorkspace } from "@/lib/server/context";
import { updateBudgets } from "@/lib/apple-ads/service";
import { adsRoute, idString, writeAccess, writeFlags } from "@/lib/apple-ads/http";

export const POST = adsRoute(async (req) => {
  const ctx = await requireWorkspace();
  const input = await body(
    req,
    z.object({ changes: z.array(z.object({ campaignId: idString, dailyBudget: z.number().positive().max(1_000_000) })).min(1).max(200), enforceCaps: z.boolean().optional(), ...writeFlags }),
  );
  return json(await updateBudgets(ctx.workspaceId, input.changes, writeAccess(ctx, input)));
});
