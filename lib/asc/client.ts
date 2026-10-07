import { createHash } from "node:crypto";
import { importPKCS8, SignJWT } from "jose";
import { wsKey } from "@/lib/server/cache";
import { db } from "@/lib/server/db";
import { HttpError } from "@/lib/server/http";
import { getSetting } from "@/lib/server/settings";

export const ASC_BASE = "https://api.appstoreconnect.apple.com";

export type AscCredentials = { issuerId: string; keyId: string; privateKey: string };

export type AscResource<A = Record<string, unknown>> = {
  type: string;
  id: string;
  attributes?: A;
  relationships?: Record<string, { data?: { type: string; id: string } | { type: string; id: string }[] | null }>;
};

export type AscDocument<A = Record<string, unknown>> = {
  data: AscResource<A>[];
  included?: AscResource[];
  links?: { next?: string };
  meta?: { paging?: { total?: number; limit?: number } };
};

export type AscSingle<A = Record<string, unknown>> = {
  data: AscResource<A>;
  included?: AscResource[];
};

type AscErrorItem = { status?: string; code?: string; title?: string; detail?: string; source?: { pointer?: string; parameter?: string } };

export class AscError extends HttpError {
  constructor(
    public appleStatus: number,
    message: string,
    public errors: AscErrorItem[] = [],
  ) {
    super(appleStatus >= 500 || appleStatus === 429 ? 502 : appleStatus === 401 ? 400 : appleStatus, message);
  }

  get transient() {
    return this.appleStatus === 429 || this.appleStatus >= 500;
  }
}

export async function ascCredentials(workspaceId: string): Promise<AscCredentials | null> {
  const [issuerId, keyId, privateKey] = await Promise.all([
    getSetting(workspaceId, "asc.issuerId"),
    getSetting(workspaceId, "asc.keyId"),
    getSetting(workspaceId, "asc.privateKey"),
  ]);
  if (!issuerId || !keyId || !privateKey) return null;
  return { issuerId, keyId, privateKey };
}

export async function isAscConfigured(workspaceId: string) {
  return (await ascCredentials(workspaceId)) !== null;
}

export function normalizePrivateKey(raw: string) {
  const trimmed = raw.trim().replace(/\r\n/g, "\n");
  if (trimmed.includes("-----BEGIN")) return trimmed;
  const body = trimmed.replace(/\s+/g, "");
  return `-----BEGIN PRIVATE KEY-----\n${body.match(/.{1,64}/g)?.join("\n") ?? body}\n-----END PRIVATE KEY-----`;
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

function tokenKey(workspaceId: string, creds: AscCredentials) {
  const fingerprint = createHash("sha256").update(`${creds.issuerId}\n${creds.keyId}\n${creds.privateKey}`).digest("hex");
  return `${workspaceId}:${fingerprint}`;
}

export function forgetAscTokens(workspaceId: string) {
  for (const k of tokenCache.keys()) if (k.startsWith(`${workspaceId}:`)) tokenCache.delete(k);
}

export async function ascToken(workspaceId: string, creds: AscCredentials) {
  const cacheKey = tokenKey(workspaceId, creds);
  const hit = tokenCache.get(cacheKey);
  if (hit && hit.expiresAt - Date.now() > 2 * 60 * 1000) return hit.token;
  let key: CryptoKey;
  try {
    key = await importPKCS8(normalizePrivateKey(creds.privateKey), "ES256");
  } catch {
    throw new HttpError(400, "The private key is not a valid App Store Connect .p8 key");
  }
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 19 * 60;
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: creds.keyId, typ: "JWT" })
    .setIssuer(creds.issuerId)
    .setAudience("appstoreconnect-v1")
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(key);
  tokenCache.set(cacheKey, { token, expiresAt: exp * 1000 });
  return token;
}

function describeErrors(status: number, errors: AscErrorItem[]) {
  if (!errors.length) {
    if (status === 401) return "App Store Connect rejected the credentials (401). Check the issuer ID, key ID and private key.";
    if (status === 403) return "This API key does not have permission for this action (403).";
    if (status === 404) return "App Store Connect could not find this resource (404).";
    if (status === 429) return "App Store Connect rate limit reached. Try again in a minute.";
    return `App Store Connect responded ${status}`;
  }
  const messages = errors.map((e) => {
    const where = e.source?.pointer ?? e.source?.parameter;
    const text = e.detail || e.title || e.code || "Unknown error";
    return where && !text.includes(where) ? `${text} (${where})` : text;
  });
  return [...new Set(messages)].join(" · ");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type AscRequest = { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown; creds?: AscCredentials; attempts?: number };

export async function ascFetch<T>(workspaceId: string, path: string, { method = "GET", body, creds, attempts = 4 }: AscRequest = {}): Promise<T> {
  const credentials = creds ?? (await ascCredentials(workspaceId));
  if (!credentials) throw new HttpError(412, "App Store Connect is not connected");
  const url = path.startsWith("http") ? path : `${ASC_BASE}${path}`;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const token = await ascToken(workspaceId, credentials);
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(45000),
        cache: "no-store",
      });
    } catch (error) {
      lastError = error;
      await sleep(600 * 2 ** attempt);
      continue;
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text ? (JSON.parse(text) as unknown) : undefined;
    } catch {
      parsed = undefined;
    }
    if (res.ok) return parsed as T;
    const errors = ((parsed as { errors?: AscErrorItem[] } | undefined)?.errors ?? []) as AscErrorItem[];
    const error = new AscError(res.status, describeErrors(res.status, errors), errors);
    if (!error.transient || attempt === attempts - 1) throw error;
    lastError = error;
    const retryAfter = Number(res.headers.get("retry-after"));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 30) * 1000 : 1000 * 2 ** attempt);
  }
  if (lastError instanceof Error) throw new HttpError(502, `App Store Connect request failed: ${lastError.message}`);
  throw new HttpError(502, "App Store Connect request failed");
}

export function ascGet<T = Record<string, unknown>>(workspaceId: string, path: string, creds?: AscCredentials) {
  return ascFetch<AscDocument<T>>(workspaceId, path, { creds });
}

export function ascGetOne<T = Record<string, unknown>>(workspaceId: string, path: string, creds?: AscCredentials) {
  return ascFetch<AscSingle<T>>(workspaceId, path, { creds });
}

export async function ascGetAll<T = Record<string, unknown>>(workspaceId: string, path: string, maxPages = 50): Promise<AscDocument<T>> {
  const data: AscResource<T>[] = [];
  const included = new Map<string, AscResource>();
  let next: string | undefined = path;
  for (let page = 0; next && page < maxPages; page++) {
    const doc: AscDocument<T> = await ascFetch<AscDocument<T>>(workspaceId, next);
    data.push(...doc.data);
    for (const item of doc.included ?? []) included.set(`${item.type}:${item.id}`, item);
    next = doc.links?.next;
  }
  return { data, included: [...included.values()] };
}

export function ascPost<T = AscSingle>(workspaceId: string, path: string, body: unknown) {
  return ascFetch<T>(workspaceId, path, { method: "POST", body, attempts: 3 });
}

export function ascPatch<T = AscSingle>(workspaceId: string, path: string, body: unknown) {
  return ascFetch<T>(workspaceId, path, { method: "PATCH", body, attempts: 3 });
}

export function ascDelete(workspaceId: string, path: string) {
  return ascFetch<void>(workspaceId, path, { method: "DELETE", attempts: 3 });
}

export function relId(resource: AscResource, name: string): string | null {
  const data = resource.relationships?.[name]?.data;
  if (!data || Array.isArray(data)) return null;
  return data.id;
}

export function relIds(resource: AscResource, name: string): string[] {
  const data = resource.relationships?.[name]?.data;
  if (!data) return [];
  return Array.isArray(data) ? data.map((d) => d.id) : [data.id];
}

export function indexIncluded(included: AscResource[] | undefined) {
  const map = new Map<string, AscResource>();
  for (const item of included ?? []) map.set(`${item.type}:${item.id}`, item);
  return (type: string, id: string | null) => (id ? map.get(`${type}:${id}`) : undefined);
}

export function query(params: Record<string, string | number | undefined | null>) {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export function ascCacheKey(workspaceId: string, key: string) {
  return wsKey(workspaceId, key);
}

export async function clearAscCache(workspaceId: string, prefix = "asc:") {
  const full = wsKey(workspaceId, prefix);
  await db.run("DELETE FROM cache WHERE key LIKE ?", [`${full.replace(/[\\%_]/g, (c) => `\\${c}`)}%`]);
}

export const ASC_TTL = 5 * 60 * 1000;

export type AscAppSummary = { id: string; name: string; bundleId: string; sku: string; primaryLocale: string };

export async function testAscConnection(workspaceId: string, creds?: AscCredentials) {
  const doc = await ascFetch<AscDocument<{ name: string; bundleId: string }>>(workspaceId, "/v1/apps?limit=1&fields[apps]=name,bundleId", { creds, attempts: 2 });
  return { ok: true as const, sampleApp: doc.data[0]?.attributes?.name ?? null };
}
