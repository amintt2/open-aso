import { z } from "zod";
import { body, json } from "@/lib/server/http";
import { createCampaigns, listCampaigns } from "@/lib/apple-ads/service";
import { adsRoute, searchOpts, writeFlags } from "@/lib/apple-ads/http";

const money = z.number().positive().max(1_000_000);
const plannedCampaign = z.object({
  name: z.string().trim().min(1).max(200),
  country: z.string().length(2),
  adamId: z.number().int().positive(),
  dailyBudget: money,
  currency: z.string().length(3),
  supplySource: z.literal("APPSTORE_SEARCH_RESULTS"),
  status: z.enum(["ENABLED", "PAUSED"]),
  adGroup: z.object({
    name: z.string().trim().min(1).max(200),
    defaultBid: money,
    searchMatch: z.boolean(),
    keywords: z.array(z.object({ text: z.string().trim().min(1).max(80), matchType: z.enum(["EXACT", "BROAD"]), bid: money })).max(1000),
    negatives: z.array(z.object({ text: z.string().trim().min(1).max(80), matchType: z.enum(["EXACT", "BROAD"]) })).max(5000),
  }),
});

export const GET = adsRoute(async (req) => json(await listCampaigns(searchOpts(req))));

export const POST = adsRoute(async (req) => {
  const input = await body(req, z.object({ plan: z.object({ campaigns: z.array(plannedCampaign).min(1).max(50), warnings: z.array(z.string()) }), ...writeFlags }));
  return json(await createCampaigns(input.plan, input));
});
