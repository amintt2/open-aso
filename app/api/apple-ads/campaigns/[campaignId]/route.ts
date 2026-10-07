import { z } from "zod";
import { body, HttpError, json } from "@/lib/server/http";
import { requireWorkspace } from "@/lib/server/context";
import { getCampaignDetail, pauseEntities, updateBudgets } from "@/lib/apple-ads/service";
import { adsRoute, searchOpts, segment, writeAccess, writeFlags } from "@/lib/apple-ads/http";

type Ctx = { params: Promise<{ campaignId: string }> };

export const GET = adsRoute<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  return json(await getCampaignDetail(workspaceId, await segment(params, "campaignId"), searchOpts(req)));
});

export const PATCH = adsRoute<Ctx>(async (req, { params }) => {
  const ctx = await requireWorkspace();
  const campaignId = await segment(params, "campaignId");
  const input = await body(req, z.object({ status: z.enum(["ENABLED", "PAUSED"]).optional(), dailyBudget: z.number().positive().max(1_000_000).optional(), enforceCaps: z.boolean().optional(), ...writeFlags }));
  const opts = writeAccess(ctx, input);
  if (input.status) return json(await pauseEntities(ctx.workspaceId, [{ type: "campaign", campaignId, status: input.status }], opts));
  if (input.dailyBudget) return json(await updateBudgets(ctx.workspaceId, [{ campaignId, dailyBudget: input.dailyBudget }], opts));
  throw new HttpError(400, "Nothing to update");
});
