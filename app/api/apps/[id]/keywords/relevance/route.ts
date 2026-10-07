import { z } from "zod";
import { isCountry } from "@/lib/appstore/countries";
import { getApp } from "@/lib/aso/apps";
import { scoreTrackedKeywords } from "@/lib/relevance/tracked";
import { requireWorkspace } from "@/lib/server/context";
import { body, HttpError, idParam, json, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  const appId = await idParam(params);
  const input = await body(req, z.object({ country: z.string().min(2).max(3).optional() }));
  const app = await getApp(workspaceId, appId);
  const country = (input.country ?? app.primaryCountry).toLowerCase();
  if (country !== "all" && !isCountry(country)) throw new HttpError(400, "Unsupported country");
  rateLimit(workspaceId, "relevance");
  return json(await scoreTrackedKeywords(workspaceId, appId, country));
});
