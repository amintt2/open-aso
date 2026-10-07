import { db } from "@/lib/server/db";
import { cacheDelete, wsKey } from "@/lib/server/cache";

export type AdsPrefKey = "targetCpa" | "lastError" | "lastCheckedAt" | "orgName" | "currency" | "orgs";

export async function getPref(workspaceId: string, key: AdsPrefKey): Promise<string | undefined> {
  const row = await db.get<{ value: string }>("SELECT value FROM ads_prefs WHERE workspace_id = ? AND key = ?", [workspaceId, key]);
  return row?.value;
}

export async function getPrefs(workspaceId: string): Promise<Partial<Record<AdsPrefKey, string>>> {
  const rows = await db.all<{ key: AdsPrefKey; value: string }>("SELECT key, value FROM ads_prefs WHERE workspace_id = ?", [workspaceId]);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function setPref(workspaceId: string, key: AdsPrefKey, value: string | null) {
  if (value === null || value === "") {
    await db.run("DELETE FROM ads_prefs WHERE workspace_id = ? AND key = ?", [workspaceId, key]);
    return;
  }
  await db.run(
    "INSERT INTO ads_prefs (workspace_id, key, value, updated_at) VALUES (?, ?, ?, now()) ON CONFLICT (workspace_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    [workspaceId, key, value],
  );
}

export async function logChange(workspaceId: string, orgId: string | null, action: string, payload: unknown, result: unknown, ok: boolean, userId: string | null = null) {
  await db.run("INSERT INTO ads_change_log (workspace_id, user_id, org_id, action, payload, result, ok) VALUES (?, ?, ?, ?, ?::jsonb, ?::jsonb, ?)", [
    workspaceId,
    userId,
    orgId,
    action,
    JSON.stringify(payload ?? null),
    JSON.stringify(result ?? null),
    ok,
  ]);
}

export type ChangeLogEntry = { id: number; orgId: string | null; userId: string | null; action: string; payload: string; result: string | null; ok: number; createdAt: string };

export async function recentChanges(workspaceId: string, limit = 50): Promise<ChangeLogEntry[]> {
  const rows = await db.all<{ id: number; org_id: string | null; user_id: string | null; action: string; payload: unknown; result: unknown; ok: boolean; created_at: string }>(
    "SELECT id, org_id, user_id, action, payload, result, ok, created_at FROM ads_change_log WHERE workspace_id = ? ORDER BY id DESC LIMIT ?",
    [workspaceId, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    orgId: r.org_id,
    userId: r.user_id,
    action: r.action,
    payload: JSON.stringify(r.payload),
    result: r.result == null ? null : JSON.stringify(r.result),
    ok: r.ok ? 1 : 0,
    createdAt: r.created_at,
  }));
}

export function adsCacheKey(workspaceId: string, key: string) {
  return wsKey(workspaceId, `ads:${key}`);
}

export async function clearAdsCache(workspaceId: string) {
  await cacheDelete(wsKey(workspaceId, "ads:"));
}
