import { db } from "@/lib/server/db";
import { requireWorkspace } from "@/lib/server/context";
import {
  PLANS,
  workspaceLimits,
  workspacePlan,
  workspaceUsage,
} from "@/lib/server/plans";
import { json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const { workspaceId, role } = await requireWorkspace();
  const [workspace, plan, limits, usage, keywords] = await Promise.all([
    db.get<{ name: string }>(
      `SELECT "name" FROM "organization" WHERE "id" = ?`,
      [workspaceId],
    ),
    workspacePlan(workspaceId),
    workspaceLimits(workspaceId),
    workspaceUsage(workspaceId),
    db.get<{ total: number; lastRefreshedAt: string | null; stale: number }>(
      `SELECT COUNT(*) AS total, MAX(k.last_refreshed_at) AS "lastRefreshedAt",
              COUNT(*) FILTER (WHERE k.last_refreshed_at IS NULL OR k.last_refreshed_at < now() - interval '20 hours') AS stale
       FROM keywords k JOIN apps a ON a.id = k.app_id WHERE a.workspace_id = ?`,
      [workspaceId],
    ),
  ]);
  return json({
    workspace: {
      id: workspaceId,
      name: workspace?.name ?? "Workspace",
      role,
      canManage: role !== "member",
    },
    plan: { id: plan, label: PLANS[plan].label, limits, usage },
    scheduler: {
      disabled: process.env.OPEN_ASO_DISABLE_SCHEDULER === "1",
      keywords: keywords?.total ?? 0,
      staleKeywords: keywords?.stale ?? 0,
      lastRefreshedAt: keywords?.lastRefreshedAt ?? null,
    },
  });
});
