import { z } from "zod";
import { getKeywordImpact, getSearchShare, impactDays, setSearchShare } from "@/lib/impact/service";
import { requireWorkspace } from "@/lib/server/context";
import { body, HttpError, json, route } from "@/lib/server/http";

const DEMO = ["never", "auto", "only"] as const;

export const GET = route(async (req) => {
  const { workspaceId } = await requireWorkspace();
  const params = new URL(req.url).searchParams;
  const appId = Number(params.get("appId"));
  if (!Number.isInteger(appId) || appId <= 0) throw new HttpError(400, "appId is required");
  const country = params.get("country")?.trim().toLowerCase() || "all";
  if (country !== "all" && !/^[a-z]{2}$/.test(country)) throw new HttpError(400, "country must be a two-letter code or all");
  const demoParam = params.get("demo");
  const demo = DEMO.find((d) => d === demoParam) ?? "auto";
  return json(await getKeywordImpact(workspaceId, appId, { country, days: impactDays(params.get("days")), demo }));
});

export const PUT = route(async (req) => {
  const { workspaceId } = await requireWorkspace("admin");
  const input = await body(req, z.object({ searchShare: z.number().min(0.05).max(1).nullable() }));
  await setSearchShare(workspaceId, input.searchShare);
  return json({ searchShare: await getSearchShare(workspaceId) });
});
