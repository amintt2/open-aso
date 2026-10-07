import { getWorkspaceJob, publicJob } from "@/lib/suggestions/jobs";
import type { OpportunityScan } from "@/lib/opportunities/types";
import { requireWorkspace } from "@/lib/server/context";
import { HttpError, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ jobId: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  const { jobId } = await params;
  const job = getWorkspaceJob<OpportunityScan>(workspaceId, jobId, "opportunities");
  if (!job) throw new HttpError(404, "Job not found");
  return json(publicJob(job));
});
