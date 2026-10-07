import { auth } from "@/lib/auth";
import { requireWorkspace } from "@/lib/server/context";
import { db } from "@/lib/server/db";
import { HttpError, json, route } from "@/lib/server/http";
import { authCall } from "@/lib/workspace/service";

export const DELETE = route<{ params: Promise<{ id: string }> }>(
  async (_req, { params }) => {
    const { workspaceId } = await requireWorkspace("admin");
    const { id } = await params;
    const row = await db.get(
      `SELECT 1 FROM "invitation" WHERE "id" = ? AND "organizationId" = ?`,
      [id, workspaceId],
    );
    if (!row) throw new HttpError(404, "Invitation not found");
    await authCall((headers) =>
      auth.api.cancelInvitation({ headers, body: { invitationId: id } }),
    );
    return json({ ok: true });
  },
);
