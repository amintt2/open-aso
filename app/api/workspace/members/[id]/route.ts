import { z } from "zod";
import { auth } from "@/lib/auth";
import { requireWorkspace } from "@/lib/server/context";
import { db } from "@/lib/server/db";
import { body, HttpError, json, route } from "@/lib/server/http";
import { authCall } from "@/lib/workspace/service";

type Ctx = { params: Promise<{ id: string }> };

async function memberIn(workspaceId: string, id: string) {
  const row = await db.get<{ id: string; userId: string; role: string }>(
    `SELECT "id", "userId", "role" FROM "member" WHERE "id" = ? AND "organizationId" = ?`,
    [id, workspaceId],
  );
  if (!row) throw new HttpError(404, "Member not found");
  return row;
}

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { workspaceId, userId, role } = await requireWorkspace("admin");
  const member = await memberIn(workspaceId, (await params).id);
  const input = await body(
    req,
    z.object({ role: z.enum(["owner", "admin", "member"]) }),
  );
  if (member.userId === userId)
    throw new HttpError(400, "You can't change your own role.");
  if ((input.role === "owner" || member.role === "owner") && role !== "owner")
    throw new HttpError(403, "Only an owner can change owners.");
  await authCall((headers) =>
    auth.api.updateMemberRole({
      headers,
      body: {
        memberId: member.id,
        role: input.role,
        organizationId: workspaceId,
      },
    }),
  );
  return json({ ok: true });
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const { workspaceId, userId, role } = await requireWorkspace("admin");
  const member = await memberIn(workspaceId, (await params).id);
  if (member.userId === userId)
    throw new HttpError(400, "Use “Leave workspace” to remove yourself.");
  if (member.role === "owner" && role !== "owner")
    throw new HttpError(403, "Only an owner can remove an owner.");
  await authCall((headers) =>
    auth.api.removeMember({
      headers,
      body: { memberIdOrEmail: member.id, organizationId: workspaceId },
    }),
  );
  return json({ ok: true });
});
