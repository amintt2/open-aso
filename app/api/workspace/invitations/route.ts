import { z } from "zod";
import { auth } from "@/lib/auth";
import { requireWorkspace } from "@/lib/server/context";
import { body, HttpError, json, route } from "@/lib/server/http";
import { authCall, workspaceInvites } from "@/lib/workspace/service";

export const GET = route(async () => {
  const { workspaceId } = await requireWorkspace("admin");
  return json(await workspaceInvites(workspaceId));
});

export const POST = route(async (req) => {
  const { workspaceId, role } = await requireWorkspace("admin");
  const input = await body(
    req,
    z.object({
      email: z.string().trim().toLowerCase().pipe(z.email()),
      role: z.enum(["owner", "admin", "member"]),
    }),
  );
  if (input.role === "owner" && role !== "owner")
    throw new HttpError(403, "Only an owner can invite another owner.");
  const invitation = await authCall((headers) =>
    auth.api.createInvitation({
      headers,
      body: {
        email: input.email,
        role: input.role,
        organizationId: workspaceId,
        resend: true,
      },
    }),
  );
  return json({ id: invitation.id }, { status: 201 });
});
