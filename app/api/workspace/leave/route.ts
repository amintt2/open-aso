import { auth } from "@/lib/auth";
import { requireWorkspace } from "@/lib/server/context";
import { HttpError, json, route } from "@/lib/server/http";
import { authCall, userWorkspaces } from "@/lib/workspace/service";

export const POST = route(async () => {
  const { workspaceId, userId } = await requireWorkspace();
  const mine = await userWorkspaces(userId);
  if (mine.length <= 1)
    throw new HttpError(400, "You can't leave your only workspace.");
  await authCall((headers) =>
    auth.api.leaveOrganization({
      headers,
      body: { organizationId: workspaceId },
    }),
  );
  return json({ ok: true });
});
