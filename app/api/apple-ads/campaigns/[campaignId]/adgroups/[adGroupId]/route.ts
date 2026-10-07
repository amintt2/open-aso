import { z } from "zod";
import { body, HttpError, json } from "@/lib/server/http";
import { requireWorkspace } from "@/lib/server/context";
import { getAdGroupDetail, pauseEntities, setSearchMatch, updateAdGroupBids } from "@/lib/apple-ads/service";
import { adsRoute, searchOpts, segment, writeAccess, writeFlags } from "@/lib/apple-ads/http";

type Ctx = { params: Promise<{ campaignId: string; adGroupId: string }> };

export const GET = adsRoute<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  return json(await getAdGroupDetail(workspaceId, await segment(params, "campaignId"), await segment(params, "adGroupId"), searchOpts(req)));
});

export const PATCH = adsRoute<Ctx>(async (req, { params }) => {
  const ctx = await requireWorkspace();
  const campaignId = await segment(params, "campaignId");
  const adGroupId = await segment(params, "adGroupId");
  const input = await body(req, z.object({ status: z.enum(["ENABLED", "PAUSED"]).optional(), defaultBid: z.number().positive().max(10_000).optional(), searchMatch: z.boolean().optional(), ...writeFlags }));
  const opts = writeAccess(ctx, input);
  if (input.status) return json(await pauseEntities(ctx.workspaceId, [{ type: "adgroup", campaignId, adGroupId, status: input.status }], opts));
  if (input.defaultBid) return json(await updateAdGroupBids(ctx.workspaceId, [{ campaignId, adGroupId, defaultBid: input.defaultBid }], opts));
  if (input.searchMatch !== undefined) return json(await setSearchMatch(ctx.workspaceId, { campaignId, adGroupId, enabled: input.searchMatch }, opts));
  throw new HttpError(400, "Nothing to update");
});
