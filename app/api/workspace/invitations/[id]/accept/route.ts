import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/server/context";
import { json, route } from "@/lib/server/http";
import { authCall } from "@/lib/workspace/service";

export const POST = route<{ params: Promise<{ id: string }> }>(
  async (_req, { params }) => {
    await requireUser();
    const { id } = await params;
    const result = await authCall((headers) =>
      auth.api.acceptInvitation({ headers, body: { invitationId: id } }),
    );
    return json({ workspaceId: result?.invitation.organizationId ?? null });
  },
);
