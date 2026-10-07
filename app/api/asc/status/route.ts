import { getAscStatus } from "@/lib/asc/status";
import { requireWorkspace } from "@/lib/server/context";
import { json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const { workspaceId } = await requireWorkspace();
  const refresh = new URL(req.url).searchParams.get("refresh") === "1";
  return json(await getAscStatus(workspaceId, { refresh }));
});
