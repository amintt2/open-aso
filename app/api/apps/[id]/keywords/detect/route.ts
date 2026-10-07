import { z } from "zod";
import { getApp } from "@/lib/aso/apps";
import { lastDetection, runningDetection, startDetection } from "@/lib/keywords/autodetect";
import { body, idParam, json, route } from "@/lib/server/http";
import { getJob, publicJob } from "@/lib/suggestions/jobs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const appId = await idParam(params);
  const search = new URL(req.url).searchParams;
  const jobId = search.get("jobId");
  const country = (search.get("country") ?? getApp(appId).primaryCountry).toLowerCase();
  const job = jobId ? getJob(jobId) : runningDetection(appId, country);
  return json({ job: job ? publicJob(job) : null, last: lastDetection(appId, country) });
});

export const POST = route<Ctx>(async (req, { params }) => {
  const appId = await idParam(params);
  const input = await body(req, z.object({ country: z.string().length(2).optional() }));
  const country = (input.country ?? getApp(appId).primaryCountry).toLowerCase();
  return json({ job: publicJob(startDetection(appId, country)) }, { status: 202 });
});
