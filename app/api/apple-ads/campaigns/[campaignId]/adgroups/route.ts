import { z } from "zod";
import { body, json } from "@/lib/server/http";
import { requireWorkspace } from "@/lib/server/context";
import { createAdGroup } from "@/lib/apple-ads/service";
import { adsRoute, segment, writeAccess, writeFlags } from "@/lib/apple-ads/http";

type Ctx = { params: Promise<{ campaignId: string }> };

export const POST = adsRoute<Ctx>(async (req, { params }) => {
  const ctx = await requireWorkspace();
  const campaignId = await segment(params, "campaignId");
  const input = await body(
    req,
    z.object({
      name: z.string().trim().min(1).max(200),
      defaultBid: z.number().positive().max(10_000),
      searchMatch: z.boolean(),
      matchType: z.enum(["EXACT", "BROAD"]),
      keywords: z.array(z.object({ text: z.string().min(1).max(80), bid: z.number().positive().nullable().optional() })).max(1000),
      status: z.enum(["ENABLED", "PAUSED"]).optional(),
      ...writeFlags,
    }),
  );
  return json(await createAdGroup(ctx.workspaceId, { ...input, campaignId }, writeAccess(ctx, input)));
});
