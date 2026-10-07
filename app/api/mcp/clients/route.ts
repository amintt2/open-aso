import { z } from "zod";
import { listWorkspaceGrants, revokeWorkspaceGrant } from "@/lib/oauth/tokens";
import { requireWorkspace } from "@/lib/server/context";
import { body, HttpError, json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const { workspaceId, userId, role } = await requireWorkspace();
  const grants = await listWorkspaceGrants(workspaceId);
  const canManage = role !== "member";
  return json({
    canManage,
    clients: grants.map((g) => ({ ...g, mine: g.userId === userId, canRevoke: canManage || g.userId === userId })),
  });
});

export const DELETE = route(async (req) => {
  const { workspaceId, userId, role } = await requireWorkspace();
  const { familyId } = await body(req, z.object({ familyId: z.uuid() }));
  const revoked = await revokeWorkspaceGrant(workspaceId, familyId, role === "member" ? userId : undefined);
  if (!revoked) throw new HttpError(404, "Connection not found");
  return json({ ok: true });
});
