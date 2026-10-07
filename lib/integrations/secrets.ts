import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getSetting, setSetting, type SettingKey } from "@/lib/server/settings";
import { HttpError } from "@/lib/server/http";

export function safeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
}

export function generateToken(prefix: string) {
  return `${prefix}_${randomBytes(24).toString("base64url")}`;
}

export function bearerToken(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : header.trim();
}

export function requireSecret(key: SettingKey, provided: string, label: string) {
  const expected = getSetting(key);
  if (!expected) throw new HttpError(503, `${label} is not configured in Open ASO`);
  if (!provided || !safeEqual(provided, expected)) throw new HttpError(401, "Unauthorized");
}

export function maskSecret(value: string | undefined) {
  if (!value) return null;
  const prefix = value.includes("_") ? value.slice(0, value.indexOf("_") + 1) : "";
  return `${prefix.slice(0, 8)}••••${value.slice(-4)}`;
}

export const TOKEN_KINDS = {
  revenuecat: { key: "integrations.revenuecat.token", prefix: "rc" },
  sdk: { key: "integrations.sdk.token", prefix: "oaso" },
} as const satisfies Record<string, { key: SettingKey; prefix: string }>;

export type TokenKind = keyof typeof TOKEN_KINDS;

export function rotateToken(kind: TokenKind) {
  const { key, prefix } = TOKEN_KINDS[kind];
  const token = generateToken(prefix);
  setSetting(key, token);
  return token;
}

export function revokeToken(kind: TokenKind) {
  setSetting(TOKEN_KINDS[kind].key, null);
}
