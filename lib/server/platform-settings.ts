import { db } from "./db";
import { decrypt, encrypt } from "./crypto";

export type PlatformKey =
  | "ads.clientId"
  | "ads.teamId"
  | "ads.keyId"
  | "ads.privateKey"
  | "ads.publicKey"
  | "ads.adAccountId"
  | "ads.countryFilter"
  | "ads.lastError"
  | "ads.lastOkAt";

const SECRET: PlatformKey[] = ["ads.privateKey"];

export async function getPlatformSetting(key: PlatformKey) {
  const row = await db.get<{ value: string }>("SELECT value FROM platform_settings WHERE key = ?", [key]);
  if (!row) return undefined;
  return SECRET.includes(key) ? decrypt(row.value) : row.value;
}

export async function setPlatformSetting(key: PlatformKey, value: string | null) {
  if (value === null || value === "") {
    await db.run("DELETE FROM platform_settings WHERE key = ?", [key]);
    return;
  }
  await db.run(
    "INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, now()) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    [key, SECRET.includes(key) ? encrypt(value) : value],
  );
}
