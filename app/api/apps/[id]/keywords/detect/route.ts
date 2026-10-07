import { z } from "zod";
import { getApp } from "@/lib/aso/apps";
import { requireWorkspace } from "@/lib/server/context";
import { lastDetection, runningDetection, startDetection } from "@/lib/keywords/autodetect";
import { body, idParam, json, route } from "@/lib/server/http";
import { getJob, publicJob } from "@/lib/suggestions/jobs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  const appId = await idParam(params);
  const search = new URL(req.url).searchParams;
  const jobId = search.get("jobId");
  const country = (search.get("country") ?? (await getApp(workspaceId, appId)).primaryCountry).toLowerCase();
  const found = jobId ? getJob(jobId) : runningDetection(workspaceId, appId, country);
  const job = found && found.key.startsWith(`${workspaceId}:`) ? found : null;
  return json({ job: job ? publicJob(job) : null, last: await lastDetection(workspaceId, appId, country) });
});

export const POST = route<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  const appId = await idParam(params);
  const input = await body(req, z.object({ country: z.string().length(2).optional() }));
  const country = (input.country ?? (await getApp(workspaceId, appId)).primaryCountry).toLowerCase();
  return json({ job: publicJob(startDetection(workspaceId, appId, country)) }, { status: 202 });
});
