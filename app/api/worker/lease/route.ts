import { z } from "zod";
import { requireWorkspace } from "@/lib/server/context";
import { body, json, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { dropWorker, touchWorker } from "@/lib/worker/presence";
import { leaseTasks, MAX_LEASE } from "@/lib/worker/queue";
import { sharedNetworkEnabled, workspaceShares } from "@/lib/worker/sharing";

const schema = z.object({
  sessionId: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
  shared: z.boolean().default(false),
  max: z.number().int().min(0).max(MAX_LEASE).default(2),
  leave: z.boolean().optional(),
});

export const POST = route(async (req) => {
  const { workspaceId, userId } = await requireWorkspace();
  const input = await body(req, schema);
  rateLimit(`${userId}:${input.sessionId}`, "workerLease");
  rateLimit(userId, "workerUser");
  if (input.leave) {
    dropWorker(workspaceId, userId, input.sessionId);
    return json({ tasks: [], shared: false });
  }
  const shared = input.shared && (await workspaceShares(workspaceId));
  touchWorker({ workspaceId, userId, sessionId: input.sessionId, shared });
  const tasks = input.max > 0 ? await leaseTasks({ workspaceId, userId, sessionId: input.sessionId, max: input.max, includeShared: shared }) : [];
  return json({
    tasks: tasks.map(({ id, url }) => ({ id, url })),
    shared,
    platformShared: sharedNetworkEnabled(),
  });
});
