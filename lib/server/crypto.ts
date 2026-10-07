import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

function key() {
  const raw = process.env.OPEN_ASO_ENCRYPTION_KEY;
  if (!raw) throw new Error("OPEN_ASO_ENCRYPTION_KEY is not set");
  return createHash("sha256").update(raw).digest();
}

export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${data.toString("base64")}`;
}

export function decrypt(value: string) {
  if (!value.startsWith("v1:")) return value;
  const [, iv, tag, data] = value.split(":");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken(prefix: string) {
  return `${prefix}_${randomBytes(24).toString("base64url")}`;
}

export function safeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
}
