import { z } from "zod";
import { body, json } from "@/lib/server/http";
import { requireWorkspace } from "@/lib/server/context";
import { updateBids } from "@/lib/apple-ads/service";
import { adsRoute, idString, writeAccess, writeFlags } from "@/lib/apple-ads/http";

export const POST = adsRoute(async (req) => {
  const ctx = await requireWorkspace();
  const input = await body(
    req,
    z.object({
      changes: z.array(z.object({ campaignId: idString, adGroupId: idString, keywordId: idString, bid: z.number().positive().max(10_000) })).min(1).max(1000),
      enforceCaps: z.boolean().optional(),
      ...writeFlags,
    }),
  );
  return json(await updateBids(ctx.workspaceId, input.changes, writeAccess(ctx, input)));
});
