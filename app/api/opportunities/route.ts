import { z } from "zod";
import { rateLimit } from "@/lib/server/rate-limit";
import { lastScan, startScan } from "@/lib/opportunities/scan";
import { publicJob } from "@/lib/suggestions/jobs";
import { requireWorkspace } from "@/lib/server/context";
import { body, HttpError, json, route } from "@/lib/server/http";

export const GET = route(async (req) => {
  const { workspaceId } = await requireWorkspace();
  const appId = Number(new URL(req.url).searchParams.get("appId"));
  if (!Number.isInteger(appId) || appId <= 0) throw new HttpError(400, "appId is required");
  return json(await lastScan(workspaceId, appId));
});

export const POST = route(async (req) => {
  const { workspaceId } = await requireWorkspace();
  const input = await body(
    req,
    z.object({ appId: z.number().int().positive(), term: z.string().min(1).max(100), countries: z.array(z.string().length(2)).min(1).max(100) }),
  );
  rateLimit(workspaceId, "opportunities");
  return json(publicJob(await startScan(workspaceId, input.appId, input.term, input.countries)), { status: 202 });
});
