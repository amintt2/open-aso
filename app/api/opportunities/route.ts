import { z } from "zod";
import { lastScan, startScan } from "@/lib/opportunities/scan";
import { publicJob } from "@/lib/suggestions/jobs";
import { body, HttpError, json, route } from "@/lib/server/http";

export const GET = route(async (req) => {
  const appId = Number(new URL(req.url).searchParams.get("appId"));
  if (!Number.isInteger(appId) || appId <= 0) throw new HttpError(400, "appId is required");
  return json(lastScan(appId));
});

export const POST = route(async (req) => {
  const input = await body(
    req,
    z.object({ appId: z.number().int().positive(), term: z.string().min(1).max(100), countries: z.array(z.string().length(2)).min(1).max(100) }),
  );
  return json(publicJob(startScan(input.appId, input.term, input.countries)), { status: 202 });
});
