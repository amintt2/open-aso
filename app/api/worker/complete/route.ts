import { z } from "zod";
import { requireWorkspace } from "@/lib/server/context";
import { body, HttpError, json, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { completeTask } from "@/lib/worker/queue";
import { MAX_BODY_BYTES } from "@/lib/worker/urls";

const schema = z.object({
  sessionId: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
  id: z.number().int().positive(),
  status: z.number().int().min(0).max(999),
  body: z.string().max(MAX_BODY_BYTES).optional(),
  error: z.string().max(500).optional(),
});

export const POST = route(async (req) => {
  const { workspaceId, userId } = await requireWorkspace();
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY_BYTES + 4096) throw new HttpError(413, "Response too large");
  const input = await body(req, schema);
  rateLimit(`${userId}:${input.sessionId}`, "workerComplete");
  rateLimit(userId, "workerUser");
  const outcome = await completeTask({ workspaceId, userId, ...input });
  if (outcome === "unknown") throw new HttpError(409, "This task is no longer leased to this browser");
  return json({ outcome });
});
