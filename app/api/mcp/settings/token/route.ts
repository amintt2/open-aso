import { clearMcpToken, rotateMcpToken } from "@/lib/mcp/config";
import { requireWorkspace } from "@/lib/server/context";
import { json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const POST = route(async () => {
  const { workspaceId } = await requireWorkspace("admin");
  return json({ token: await rotateMcpToken(workspaceId) }, { headers: { "Cache-Control": "no-store" } });
});

export const DELETE = route(async () => {
  const { workspaceId } = await requireWorkspace("admin");
  await clearMcpToken(workspaceId);
  return json({ ok: true });
});
