import { integrationsStatus } from "@/lib/integrations/status";
import { requireWorkspace } from "@/lib/server/context";
import { json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const { workspaceId, role } = await requireWorkspace();
  return json(await integrationsStatus(workspaceId, role !== "member"));
});
