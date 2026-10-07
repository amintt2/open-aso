import { listAscApps } from "@/lib/asc/apps";
import { requireWorkspace } from "@/lib/server/context";
import { json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const { workspaceId } = await requireWorkspace();
  return json(await listAscApps(workspaceId));
});
