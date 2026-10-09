import { wsKey } from "@/lib/server/cache";
import { db } from "@/lib/server/db";

export function analyticsCachePrefix(workspaceId: string) {
  return wsKey(workspaceId, "store-analytics:");
}

export async function dataThroughFor(workspaceId: string, appId: number) {
  const rows = await db.all<{ family: string; d: string }>(
    "SELECT family, max(date) AS d FROM asc_analytics_coverage WHERE workspace_id = ? AND app_id = ? AND family IN ('downloads', 'engagement') GROUP BY family",
    [workspaceId, appId],
  );
  if (!rows.length) return null;
  return rows.reduce((min, r) => (r.d < min ? r.d : min), rows[0].d);
}

export async function dataSinceFor(workspaceId: string, appId: number) {
  const row = await db.get<{ d: string | null }>(
    "SELECT min(date) AS d FROM asc_analytics_coverage WHERE workspace_id = ? AND app_id = ? AND family IN ('downloads', 'engagement')",
    [workspaceId, appId],
  );
  return row?.d ?? null;
}
