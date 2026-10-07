import { db } from "./db";

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

const SECRET_KEYS: SettingKey[] = [
  "asc.privateKey",
  "ads.privateKey",
  "ai.anthropicKey",
  "integrations.revenuecat.token",
  "integrations.superwall.secret",
  "integrations.sdk.token",
  "mcp.token",
  "posthog.apiKey",
];

export function getSetting(key: SettingKey): string | undefined {
  const row = db().prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? undefined;
}

export function setSetting(key: SettingKey, value: string | null) {
  if (value === null || value === "") {
    db().prepare("DELETE FROM settings WHERE key = ?").run(key);
    return;
  }
  db()
    .prepare(
      "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    )
    .run(key, value);
}

export function publicSettings() {
  const rows = db().prepare("SELECT key, value FROM settings").all() as {
    key: SettingKey;
    value: string;
  }[];
  return Object.fromEntries(
    rows.map((row) => [
      row.key,
      SECRET_KEYS.includes(row.key) ? { set: true } : row.value,
    ]),
  );
}
