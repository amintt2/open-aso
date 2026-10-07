import { z } from "zod";
import { body, HttpError, json } from "@/lib/server/http";
import { getCampaignDetail, pauseEntities, updateBudgets } from "@/lib/apple-ads/service";
import { adsRoute, searchOpts, segment, writeFlags } from "@/lib/apple-ads/http";

type Ctx = { params: Promise<{ campaignId: string }> };

export const GET = adsRoute<Ctx>(async (req, { params }) => json(await getCampaignDetail(await segment(params, "campaignId"), searchOpts(req))));

export const PATCH = adsRoute<Ctx>(async (req, { params }) => {
  const campaignId = await segment(params, "campaignId");
  const input = await body(req, z.object({ status: z.enum(["ENABLED", "PAUSED"]).optional(), dailyBudget: z.number().positive().max(1_000_000).optional(), enforceCaps: z.boolean().optional(), ...writeFlags }));
  if (input.status) return json(await pauseEntities([{ type: "campaign", campaignId, status: input.status }], input));
  if (input.dailyBudget) return json(await updateBudgets([{ campaignId, dailyBudget: input.dailyBudget }], input));
  throw new HttpError(400, "Nothing to update");
});
