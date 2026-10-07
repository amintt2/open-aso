import { getJob, publicJob } from "@/lib/suggestions/jobs";
import type { SuggestionsResult } from "@/lib/suggestions/types";
import { HttpError, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ jobId: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const { jobId } = await params;
  const job = getJob<SuggestionsResult>(jobId);
  if (!job || job.kind !== "suggestions") throw new HttpError(404, "Job not found");
  return json(publicJob(job));
});
