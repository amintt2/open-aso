import { z } from "zod";
import { body, json } from "@/lib/server/http";
import { pauseEntities } from "@/lib/apple-ads/service";
import { adsRoute, idString, writeFlags } from "@/lib/apple-ads/http";

const entity = z.discriminatedUnion("type", [
  z.object({ type: z.literal("campaign"), campaignId: idString, status: z.enum(["ENABLED", "PAUSED"]) }),
  z.object({ type: z.literal("adgroup"), campaignId: idString, adGroupId: idString, status: z.enum(["ENABLED", "PAUSED"]) }),
  z.object({ type: z.literal("keyword"), campaignId: idString, adGroupId: idString, keywordId: idString, status: z.enum(["ACTIVE", "PAUSED"]) }),
]);

export const POST = adsRoute(async (req) => {
  const input = await body(req, z.object({ entities: z.array(entity).min(1).max(1000), ...writeFlags }));
  return json(await pauseEntities(input.entities, input));
});
