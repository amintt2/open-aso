import { z } from "zod";
import { body, json } from "@/lib/server/http";
import { requireWorkspace } from "@/lib/server/context";
import { addNegativeKeywords } from "@/lib/apple-ads/service";
import { adsRoute, segment, writeAccess, writeFlags } from "@/lib/apple-ads/http";

type Ctx = { params: Promise<{ campaignId: string; adGroupId: string }> };

export const POST = adsRoute<Ctx>(async (req, { params }) => {
  const ctx = await requireWorkspace();
  const campaignId = await segment(params, "campaignId");
  const adGroupId = await segment(params, "adGroupId");
  const input = await body(req, z.object({ keywords: z.array(z.object({ text: z.string().min(1).max(80), matchType: z.enum(["EXACT", "BROAD"]).optional() })).min(1).max(5000), ...writeFlags }));
  return json(await addNegativeKeywords(ctx.workspaceId, { campaignId, adGroupId, keywords: input.keywords }, writeAccess(ctx, input)));
});
