import { z } from "zod";
import { getApp } from "@/lib/aso/apps";
import { requireWorkspace } from "@/lib/server/context";
import { lastDetection, lastMultiDetection, runningDetection, runningMultiDetection, startDetection, startMultiDetection } from "@/lib/keywords/autodetect";
import { COUNTRIES } from "@/lib/appstore/countries";
import { listKeywords } from "@/lib/aso/keywords";
import { body, idParam, json, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { getJob, publicJob } from "@/lib/suggestions/jobs";

type Ctx = { params: Promise<{ id: string }> };

const TOP_MARKETS = ["us", "gb", "ca", "au", "fr", "de", "es", "it", "br", "jp"];

export const GET = route<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  const appId = await idParam(params);
  const search = new URL(req.url).searchParams;
  const jobId = search.get("jobId");
  const app = await getApp(workspaceId, appId);
  const country = (search.get("country") ?? app.primaryCountry).toLowerCase();
  const multi = search.get("scope") === "multi";
  const found = jobId ? getJob(jobId) : multi ? runningMultiDetection(workspaceId, appId) : runningDetection(workspaceId, appId, country);
  const job = found && found.key.startsWith(`${workspaceId}:`) ? found : null;
  return json({ job: job ? publicJob(job) : null, last: multi ? await lastMultiDetection(workspaceId, appId) : await lastDetection(workspaceId, appId, country) });
});

export const POST = route<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  const appId = await idParam(params);
  const input = await body(
    req,
    z.object({
      country: z.string().length(2).optional(),
      scope: z.enum(["country", "tracked", "top", "all"]).optional(),
      countries: z.array(z.string().length(2)).max(66).optional(),
    }),
  );
  const app = await getApp(workspaceId, appId);
  const scope = input.scope ?? (input.countries ? "custom" : "country");
  if (scope === "country") {
    if (!runningDetection(workspaceId, appId, (input.country ?? app.primaryCountry).toLowerCase())) rateLimit(workspaceId, "detect");
    const country = (input.country ?? app.primaryCountry).toLowerCase();
    return json({ job: publicJob(startDetection(workspaceId, appId, country)) }, { status: 202 });
  }
  let countries: string[];
  if (scope === "tracked") countries = [...new Set([app.primaryCountry, ...(await listKeywords(workspaceId, appId)).map((k) => k.country)])];
  else if (scope === "top") countries = TOP_MARKETS;
  else if (scope === "all") countries = COUNTRIES.map((c) => c.code);
  else countries = (input.countries ?? []).map((c) => c.toLowerCase());
  if (!countries.length) countries = [app.primaryCountry];
  if (!runningMultiDetection(workspaceId, appId)) rateLimit(workspaceId, "detectMulti");
  return json({ job: publicJob(startMultiDetection(workspaceId, appId, countries)) }, { status: 202 });
});
