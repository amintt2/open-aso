import { getJob, publicJob } from "@/lib/suggestions/jobs";
import type { OpportunityScan } from "@/lib/opportunities/types";
import { HttpError, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ jobId: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const { jobId } = await params;
  const job = getJob<OpportunityScan>(jobId);
  if (!job || job.kind !== "opportunities") throw new HttpError(404, "Job not found");
  return json(publicJob(job));
});
