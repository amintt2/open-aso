import { egressStats } from "@/lib/appstore/egress";
import { requireAdmin } from "@/lib/server/context";
import { db } from "@/lib/server/db";
import { json, route } from "@/lib/server/http";
import { workerCounts } from "@/lib/worker/presence";
import { networkQueueStats } from "@/lib/worker/queue";
import { sharedNetworkEnabled } from "@/lib/worker/sharing";

export const GET = route(async () => {
  await requireAdmin();
  const optedIn = await db.get<{ n: number }>("SELECT count(*)::int AS n FROM workspace_settings WHERE key = 'worker.shared' AND value = 'true'");
  return json({
    egress: egressStats(),
    workers: workerCounts(),
    queue: await networkQueueStats(),
    sharedEnabled: sharedNetworkEnabled(),
    sharedWorkspaces: optedIn?.n ?? 0,
  });
});
