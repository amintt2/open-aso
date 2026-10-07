import { z } from "zod";
import { requireWorkspace } from "@/lib/server/context";
import { body, HttpError, json, route } from "@/lib/server/http";
import { activeWorkers } from "@/lib/worker/presence";
import { workspaceQueueStats } from "@/lib/worker/queue";
import { SHARED_PER_HOUR, setWorkspaceShares, sharedNetworkEnabled, workspaceOptedIn } from "@/lib/worker/sharing";

async function status(workspaceId: string, canManage: boolean) {
  const platformShared = sharedNetworkEnabled();
  const workers = activeWorkers();
  const optedIn = platformShared && (await workspaceOptedIn(workspaceId));
  return {
    platformShared,
    shared: optedIn,
    canManage,
    sharedCapPerHour: SHARED_PER_HOUR,
    workers: {
      own: workers.filter((w) => w.workspaceId === workspaceId).length,
      sharedPeers: optedIn ? workers.filter((w) => w.shared && w.workspaceId !== workspaceId).length : 0,
    },
    stats: await workspaceQueueStats(workspaceId),
  };
}

export const GET = route(async () => {
  const { workspaceId, role } = await requireWorkspace();
  return json(await status(workspaceId, role !== "member"));
});

export const PUT = route(async (req) => {
  const { workspaceId } = await requireWorkspace("admin");
  const input = await body(req, z.object({ shared: z.boolean() }));
  if (!sharedNetworkEnabled()) throw new HttpError(400, "Shared fetching is not enabled on this server");
  await setWorkspaceShares(workspaceId, input.shared);
  return json(await status(workspaceId, true));
});
