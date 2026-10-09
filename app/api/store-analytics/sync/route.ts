import { z } from "zod";
import { syncAnalytics } from "@/lib/asc/analytics/sync";
import { fixturesAllowed } from "@/lib/asc/analytics/transport";
import { requireWorkspace } from "@/lib/server/context";
import { body, HttpError, json, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";

const Input = z.object({
  appId: z.number().int().positive(),
  force: z.boolean().optional(),
  fixtures: z.enum(["data", "waiting"]).optional(),
});

export const POST = route(async (req) => {
  const input = await body(req, Input);
  const { workspaceId, role } = await requireWorkspace();
  if (input.force && role === "member") throw new HttpError(403, "Only workspace admins can force a sync");
  if (input.fixtures && !fixturesAllowed()) throw new HttpError(403, "Sample data is only available in development");
  if (!input.fixtures) rateLimit(workspaceId, "storeAnalyticsSync");
  return json(await syncAnalytics(workspaceId, input.appId, { trigger: input.force ? "forced" : "manual", fixtures: input.fixtures ?? null }));
});
