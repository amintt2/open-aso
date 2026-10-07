import { requireCredentials, testConnection } from "@/lib/posthog/client";
import { posthogStatus } from "@/lib/posthog/status";
import { requireWorkspace } from "@/lib/server/context";
import { json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const { workspaceId, role } = await requireWorkspace();
  return json({
    ...(await posthogStatus(workspaceId)),
    canManage: role !== "member",
  });
});

export const POST = route(async () => {
  const { workspaceId, role } = await requireWorkspace();
  const check = await testConnection(
    workspaceId,
    await requireCredentials(workspaceId),
  );
  return json({
    status: {
      ...(await posthogStatus(workspaceId)),
      canManage: role !== "member",
    },
    check,
  });
});
