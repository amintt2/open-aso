import { z } from "zod";
import { body, json } from "@/lib/server/http";
import { requireWorkspace } from "@/lib/server/context";
import { fixCannibalization } from "@/lib/apple-ads/service";
import { adsRoute, writeAccess, writeFlags } from "@/lib/apple-ads/http";

export const POST = adsRoute(async (req) => {
  const ctx = await requireWorkspace();
  const input = await body(req, z.object({ issueIds: z.union([z.literal("all"), z.array(z.string().max(200)).min(1).max(2000)]), ...writeFlags }));
  return json(await fixCannibalization(ctx.workspaceId, input.issueIds, writeAccess(ctx, input)));
});
