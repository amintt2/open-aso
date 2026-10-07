import { z } from "zod";
import { summarizeReviews } from "@/lib/reviews/summary";
import { scopeParam } from "@/lib/reviews/params";
import { trackIdParam } from "@/lib/explore/params";
import { body, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ trackId: string }> };

export const maxDuration = 300;

export const POST = route<Ctx>(async (req, { params }) => {
  const trackId = await trackIdParam(params);
  const input = await body(req, z.object({ country: z.string().min(2).max(3), appName: z.string().min(1).max(200) }));
  return json(await summarizeReviews(trackId, scopeParam(input.country), input.appName));
});
