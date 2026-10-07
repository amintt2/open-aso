import { requireAdmin } from "@/lib/server/context";
import { json, route } from "@/lib/server/http";
import { PLANS } from "@/lib/server/plans";
import { adminUsers, adminWorkspaces } from "@/lib/workspace/service";

export const GET = route(async () => {
  await requireAdmin();
  const [workspaces, users] = await Promise.all([
    adminWorkspaces(),
    adminUsers(),
  ]);
  return json({
    workspaces,
    users,
    plans: Object.entries(PLANS).map(([id, p]) => ({
      id,
      label: p.label,
      limits: p.limits,
    })),
  });
});
