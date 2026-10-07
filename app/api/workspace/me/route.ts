import { isAdminEmail } from "@/lib/auth";
import { requireUser } from "@/lib/server/context";
import { json, route } from "@/lib/server/http";
import {
  ensureHasWorkspace,
  pendingInvitesFor,
  setActiveWorkspace,
  userWorkspaces,
} from "@/lib/workspace/service";

export const GET = route(async () => {
  const session = await requireUser();
  const { user } = session;
  const invitations = await pendingInvitesFor(user.email);
  let workspaces = await userWorkspaces(user.id);
  let activeId =
    (session.session as { activeOrganizationId?: string | null })
      .activeOrganizationId ?? null;
  if (workspaces.length === 0 && invitations.length === 0) {
    await ensureHasWorkspace(user);
    workspaces = await userWorkspaces(user.id);
  }
  if (!workspaces.some((w) => w.id === activeId)) {
    activeId = workspaces[0]?.id ?? null;
    await setActiveWorkspace(session.session.id, activeId);
  }
  return json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image ?? null,
      isAdmin: isAdminEmail(user.email),
    },
    activeWorkspaceId: activeId,
    workspaces,
    invitations,
  });
});
