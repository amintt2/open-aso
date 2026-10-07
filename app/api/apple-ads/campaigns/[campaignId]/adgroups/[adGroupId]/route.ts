import { z } from "zod";
import { body, HttpError, json } from "@/lib/server/http";
import { getAdGroupDetail, pauseEntities, setSearchMatch, updateAdGroupBids } from "@/lib/apple-ads/service";
import { adsRoute, searchOpts, segment, writeFlags } from "@/lib/apple-ads/http";

type Ctx = { params: Promise<{ campaignId: string; adGroupId: string }> };

export const GET = adsRoute<Ctx>(async (req, { params }) =>
  json(await getAdGroupDetail(await segment(params, "campaignId"), await segment(params, "adGroupId"), searchOpts(req))),
);

export const PATCH = adsRoute<Ctx>(async (req, { params }) => {
  const campaignId = await segment(params, "campaignId");
  const adGroupId = await segment(params, "adGroupId");
  const input = await body(req, z.object({ status: z.enum(["ENABLED", "PAUSED"]).optional(), defaultBid: z.number().positive().max(10_000).optional(), searchMatch: z.boolean().optional(), ...writeFlags }));
  if (input.status) return json(await pauseEntities([{ type: "adgroup", campaignId, adGroupId, status: input.status }], input));
  if (input.defaultBid) return json(await updateAdGroupBids([{ campaignId, adGroupId, defaultBid: input.defaultBid }], input));
  if (input.searchMatch !== undefined) return json(await setSearchMatch({ campaignId, adGroupId, enabled: input.searchMatch }, input));
  throw new HttpError(400, "Nothing to update");
});
