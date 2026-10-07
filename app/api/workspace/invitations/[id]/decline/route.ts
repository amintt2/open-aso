import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/server/context";
import { json, route } from "@/lib/server/http";
import {
  authCall,
  ensureHasWorkspace,
  setActiveWorkspace,
  userWorkspaces,
} from "@/lib/workspace/service";

export const POST = route<{ params: Promise<{ id: string }> }>(
  async (_req, { params }) => {
    const session = await requireUser();
    const { id } = await params;
    await authCall((headers) =>
      auth.api.rejectInvitation({ headers, body: { invitationId: id } }),
    );
    await ensureHasWorkspace(session.user);
    const active = (session.session as { activeOrganizationId?: string | null })
      .activeOrganizationId;
    if (!active)
      await setActiveWorkspace(
        session.session.id,
        (await userWorkspaces(session.user.id))[0]?.id ?? null,
      );
    return json({ ok: true });
  },
);
