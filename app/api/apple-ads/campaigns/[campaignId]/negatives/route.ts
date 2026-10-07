import { z } from "zod";
import { body, json } from "@/lib/server/http";
import { addNegativeKeywords } from "@/lib/apple-ads/service";
import { adsRoute, segment, writeFlags } from "@/lib/apple-ads/http";

type Ctx = { params: Promise<{ campaignId: string }> };

export const POST = adsRoute<Ctx>(async (req, { params }) => {
  const campaignId = await segment(params, "campaignId");
  const input = await body(req, z.object({ keywords: z.array(z.object({ text: z.string().min(1).max(80), matchType: z.enum(["EXACT", "BROAD"]).optional() })).min(1).max(5000), ...writeFlags }));
  return json(await addNegativeKeywords({ campaignId, adGroupId: null, keywords: input.keywords }, input));
});
