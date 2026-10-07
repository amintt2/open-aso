import { db } from "./db";
import { decrypt, encrypt } from "./crypto";

export type SettingKey =
  | "asc.issuerId"
  | "asc.keyId"
  | "asc.privateKey"
  | "ads.clientId"
  | "ads.teamId"
  | "ads.keyId"
  | "ads.privateKey"
  | "ads.publicKey"
  | "ads.orgId"
  | "ai.anthropicKey"
  | "ai.model"
  | "integrations.revenuecat.token"
  | "integrations.superwall.secret"
  | "integrations.sdk.token"
  | "mcp.enabled"
  | "mcp.token"
  | "mcp.allowWrites"
  | "posthog.host"
  | "posthog.projectId"
  | "posthog.apiKey";

export const SECRET_KEYS: SettingKey[] = [
  "asc.privateKey",
  "ads.privateKey",
  "ai.anthropicKey",
  "integrations.revenuecat.token",
  "integrations.superwall.secret",
  "integrations.sdk.token",
  "mcp.token",
  "posthog.apiKey",
];

export async function getSetting(workspaceId: string, key: SettingKey): Promise<string | undefined> {
  const row = await db.get<{ value: string }>("SELECT value FROM workspace_settings WHERE workspace_id = ? AND key = ?", [workspaceId, key]);
  if (!row) return undefined;
  return SECRET_KEYS.includes(key) ? decrypt(row.value) : row.value;
}

export async function getSettings(workspaceId: string, keys: SettingKey[]): Promise<Partial<Record<SettingKey, string>>> {
  const out: Partial<Record<SettingKey, string>> = {};
  for (const key of keys) {
    const value = await getSetting(workspaceId, key);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export async function setSetting(workspaceId: string, key: SettingKey, value: string | null) {
  if (value === null || value === "") {
    await db.run("DELETE FROM workspace_settings WHERE workspace_id = ? AND key = ?", [workspaceId, key]);
    return;
  }
  const stored = SECRET_KEYS.includes(key) ? encrypt(value) : value;
  await db.run(
    "INSERT INTO workspace_settings (workspace_id, key, value, updated_at) VALUES (?, ?, ?, now()) ON CONFLICT (workspace_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    [workspaceId, key, stored],
  );
}

export async function publicSettings(workspaceId: string) {
  const rows = await db.all<{ key: SettingKey; value: string }>("SELECT key, value FROM workspace_settings WHERE workspace_id = ?", [workspaceId]);
  return Object.fromEntries(rows.map((row) => [row.key, SECRET_KEYS.includes(row.key) ? { set: true } : row.value]));
}
