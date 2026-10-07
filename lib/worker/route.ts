import { currentWorkspaceId, markUntrusted } from "@/lib/server/request-context";
import { hasOwnWorker, hasSharedWorkerFor } from "./presence";
import { requestViaWorker } from "./queue";
import { workspaceShares } from "./sharing";
import { isWorkerUrl, validateBody } from "./urls";

export async function fetchViaWorker(url: string): Promise<Response | null> {
  if (!isWorkerUrl(url)) return null;
  const workspaceId = currentWorkspaceId();
  if (!workspaceId) return null;
  try {
    const own = hasOwnWorker(workspaceId);
    const shared = await workspaceShares(workspaceId);
    if (!own && !(shared && hasSharedWorkerFor(workspaceId))) return null;
    const result = await requestViaWorker(workspaceId, url, { shared });
    if (!result || result.status !== 200 || validateBody(url, result.body)) return null;
    markUntrusted();
    return new Response(result.body, { status: 200, headers: { "content-type": "application/json" } });
  } catch (error) {
    console.error("[open-aso] browser fetch failed, using server egress", error);
    return null;
  }
}
