import { z } from "zod";
import { body, HttpError, json } from "@/lib/server/http";
import { addKeywords, pauseEntities, updateBids } from "@/lib/apple-ads/service";
import { adsRoute, idString, segment, writeFlags } from "@/lib/apple-ads/http";

type Ctx = { params: Promise<{ campaignId: string; adGroupId: string }> };

export const POST = adsRoute<Ctx>(async (req, { params }) => {
  const campaignId = await segment(params, "campaignId");
  const adGroupId = await segment(params, "adGroupId");
  const input = await body(
    req,
    z.object({
      keywords: z.array(z.object({ text: z.string().min(1).max(80), matchType: z.enum(["EXACT", "BROAD"]).optional(), bid: z.number().positive().max(10_000).nullable().optional() })).min(1).max(1000),
      ...writeFlags,
    }),
  );
  return json(await addKeywords({ campaignId, adGroupId, keywords: input.keywords }, input));
});

export const PATCH = adsRoute<Ctx>(async (req, { params }) => {
  const campaignId = await segment(params, "campaignId");
  const adGroupId = await segment(params, "adGroupId");
  const input = await body(
    req,
    z.object({
      updates: z.array(z.object({ keywordId: idString, bid: z.number().positive().max(10_000).optional(), status: z.enum(["ACTIVE", "PAUSED"]).optional() })).min(1).max(1000),
      enforceCaps: z.boolean().optional(),
      ...writeFlags,
    }),
  );
  const bids = input.updates.filter((u) => u.bid !== undefined).map((u) => ({ campaignId, adGroupId, keywordId: u.keywordId, bid: u.bid as number }));
  const statuses = input.updates.filter((u) => u.status !== undefined).map((u) => ({ type: "keyword" as const, campaignId, adGroupId, keywordId: u.keywordId, status: u.status as "ACTIVE" | "PAUSED" }));
  if (bids.length && statuses.length) throw new HttpError(400, "Update bids and statuses in separate requests");
  if (bids.length) return json(await updateBids(bids, input));
  if (statuses.length) return json(await pauseEntities(statuses, input));
  throw new HttpError(400, "Nothing to update");
});
