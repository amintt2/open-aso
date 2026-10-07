import { z } from "zod";
import { body, json } from "@/lib/server/http";
import { planCampaigns } from "@/lib/apple-ads/service";
import { adsRoute } from "@/lib/apple-ads/http";

export const POST = adsRoute(async (req) => {
  const input = await body(
    req,
    z.object({
      adamId: z.number().int().positive(),
      appName: z.string().min(1).max(200),
      countries: z.array(z.string().length(2)).min(1).max(60),
      dailyBudget: z.number().positive().max(1_000_000),
      defaultBid: z.number().positive().max(10_000),
      matchType: z.enum(["EXACT", "BROAD", "SEARCH_MATCH"]),
      namePattern: z.string().min(1).max(200),
      keywords: z.array(z.object({ text: z.string().min(1).max(80), bid: z.number().positive().nullable().optional() })).max(1000),
      negatives: z.array(z.string().max(80)).max(5000).optional(),
      status: z.enum(["ENABLED", "PAUSED"]).optional(),
      demo: z.boolean().optional(),
    }),
  );
  return json(await planCampaigns(input, { demo: input.demo }));
});
