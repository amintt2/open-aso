import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync } from "node:crypto";
import { getCountry } from "@/lib/appstore/countries";
import { normalizeTerm } from "@/lib/aso/scoring";
import { cacheGet, cacheSet, DAY } from "@/lib/server/cache";
import { HttpError } from "@/lib/server/http";
import { getPlatformSetting, setPlatformSetting } from "@/lib/server/platform-settings";
import { db } from "@/lib/server/db";
import { adminEmails } from "@/lib/auth";
import { getSettings } from "@/lib/server/settings";
import { createClientSecret, SCOPE, TOKEN_URL, type Credentials } from "./auth";

const BASE = "https://api.ads.apple.com/v1";
const TTL = 7 * DAY;
const MISS_TTL = 2 * DAY;

type Source = { kind: "workspace" | "platform"; id: string; creds: Credentials; adAccountId?: string };
type Cached = { value: number | null };

type GlobalState = {
  tokens: Map<string, { token: string; expiresAt: number }>;
  accounts: Map<string, string>;
  anchors: Map<string, string>;
  pending: Map<string, Promise<number | null>>;
  active: number;
};
type G = typeof globalThis & { __openAsoApplePop?: GlobalState };

function state(): GlobalState {
  const g = globalThis as G;
  g.__openAsoApplePop ??= { tokens: new Map(), accounts: new Map(), anchors: new Map(), pending: new Map(), active: 0 };
  return g.__openAsoApplePop;
}

function fp(c: Credentials) {
  return createHash("sha256").update(`${c.clientId}|${c.keyId}|${c.privateKey}`).digest("hex").slice(0, 24);
}

async function platformSource(): Promise<Source | null> {
  const [clientId, teamId, keyId, privateKey, adAccountId] = await Promise.all([
    getPlatformSetting("ads.clientId"),
    getPlatformSetting("ads.teamId"),
    getPlatformSetting("ads.keyId"),
    getPlatformSetting("ads.privateKey"),
    getPlatformSetting("ads.adAccountId"),
  ]);
  if (!clientId || !teamId || !keyId || !privateKey) return null;
  const creds = { clientId, teamId, keyId, privateKey };
  return { kind: "platform", id: `platform:${fp(creds)}`, creds, adAccountId: adAccountId || undefined };
}

async function workspaceSource(workspaceId: string): Promise<Source | null> {
  const s = await getSettings(workspaceId, ["ads.clientId", "ads.teamId", "ads.keyId", "ads.privateKey"]);
  if (!s["ads.clientId"] || !s["ads.teamId"] || !s["ads.keyId"] || !s["ads.privateKey"]) return null;
  const creds = { clientId: s["ads.clientId"], teamId: s["ads.teamId"], keyId: s["ads.keyId"], privateKey: s["ads.privateKey"] };
  return { kind: "workspace", id: `ws:${workspaceId}:${fp(creds)}`, creds };
}

export async function popularitySource(workspaceId?: string | null): Promise<Source | null> {
  return (workspaceId ? await workspaceSource(workspaceId) : null) ?? (await platformSource());
}

async function token(source: Source) {
  const st = state();
  const hit = st.tokens.get(source.id);
  if (hit && hit.expiresAt - 60_000 > Date.now()) return hit.token;
  const secret = await createClientSecret(source.creds);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: source.creds.clientId, client_secret: secret, scope: SCOPE }).toString(),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) throw new HttpError(502, `Apple Ads sign-in failed: ${data.error_description ?? data.error ?? res.status}`);
  st.tokens.set(source.id, { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 });
  return data.access_token;
}

async function api<T>(source: Source, path: string, init: { method?: string; body?: unknown; account?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${await token(source)}`, Accept: "application/json" };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.account !== false) headers["X-AP-Context"] = `adAccountId=${await adAccount(source)}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${BASE}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (res.status === 429 || res.status >= 500) {
      const wait = Number(res.headers.get("retry-after") ?? 0) * 1000 || 1000 * 2 ** attempt;
      await new Promise((r) => setTimeout(r, Math.min(wait, 10000)));
      continue;
    }
    const data = (await res.json().catch(() => ({}))) as T & { error?: { errors?: { message?: string; field?: string }[] } };
    if (!res.ok) {
      const detail = data.error?.errors?.map((e) => [e.field, e.message].filter(Boolean).join(": ")).join("; ");
      throw new HttpError(res.status, `Apple Ads Platform API ${res.status}${detail ? `: ${detail}` : ""}`);
    }
    return data;
  }
  throw new HttpError(429, "Apple Ads Platform API is rate limiting requests");
}

async function adAccount(source: Source) {
  if (source.adAccountId) return source.adAccountId;
  const st = state();
  const known = st.accounts.get(source.id);
  if (known) return known;
  const data = await api<{ result?: { acls?: { adAccount?: { id?: number | string }; roles?: string[] }[] } }>(source, "/acls", { account: false });
  const id = data.result?.acls?.find((a) => a.adAccount?.id != null)?.adAccount?.id;
  if (id == null) throw new HttpError(409, "This Apple Ads API user has no ad account");
  st.accounts.set(source.id, String(id));
  if (source.kind === "platform") await setPlatformSetting("ads.adAccountId", String(id));
  return String(id);
}

type KeywordRow = { text?: string; popularity?: number };

async function anchorCandidates(source: Source): Promise<string[]> {
  const configured = source.kind === "platform" ? await getPlatformSetting("ads.anchorAppId") : undefined;
  const rows = await db.all<{ track_id: number }>(
    source.kind === "workspace"
      ? "SELECT track_id FROM apps WHERE workspace_id = ? AND is_mine ORDER BY created_at ASC LIMIT 10"
      : `SELECT a.track_id FROM apps a JOIN "member" m ON m."organizationId" = a.workspace_id JOIN "user" u ON u."id" = m."userId"
         WHERE a.is_mine AND lower(u."email") = ANY(?::text[]) ORDER BY a.created_at ASC LIMIT 10`,
    [source.kind === "workspace" ? source.id.split(":")[1] : adminEmails()],
  );
  return [...new Set([...(configured ? [configured] : []), ...rows.map((r) => String(r.track_id))])];
}

async function anchorApp(source: Source): Promise<string> {
  const st = state();
  const known = st.anchors.get(source.id);
  if (known) return known;
  const candidates = await anchorCandidates(source);
  if (!candidates.length) throw new HttpError(409, "Add one of your own apps (one that exists in this Apple Ads account) so Apple popularity can be looked up");
  for (const adamId of candidates) {
    try {
      await api(source, "/suggestions/keywords/query", { method: "POST", body: keywordBody(adamId, "us", "app") });
      st.anchors.set(source.id, adamId);
      if (source.kind === "platform") await setPlatformSetting("ads.anchorAppId", adamId);
      return adamId;
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 400) throw error;
    }
  }
  throw new HttpError(409, "None of your apps is accessible in this Apple Ads account. Set the anchor app ID in Admin → Platform.");
}

function keywordBody(adamId: string, country: string, term: string) {
  return {
    filters: [
      { field: "promotedObjectId", operator: "EQUALS", value: [adamId] },
      { field: "promotedObjectType", operator: "EQUALS", value: ["APPSTORE_APP"] },
      { field: "countriesOrRegions", operator: "IN", value: [country.toUpperCase()] },
      { field: "terms", operator: "IN", value: [term] },
    ],
    pagination: { offset: 0, pageSize: 200 },
  };
}

async function lookupTerm(source: Source, term: string, country: string): Promise<number | null> {
  const adamId = await anchorApp(source);
  const data = await api<{ result?: KeywordRow[] }>(source, "/suggestions/keywords/query", { method: "POST", body: keywordBody(adamId, country, term) });
  let exact: number | null = null;
  for (const row of data.result ?? []) {
    if (!row.text || typeof row.popularity !== "number") continue;
    const t = normalizeTerm(row.text);
    if (t === term) exact = row.popularity;
    else await cacheSet(cacheKey(country, t), { value: row.popularity } satisfies Cached, TTL).catch(() => undefined);
  }
  return exact;
}

const CONCURRENCY = 3;

function enqueue(source: Source, country: string, term: string): Promise<number | null> {
  const st = state();
  const key = `${source.id}|${country}|${term}`;
  const pending = st.pending.get(key);
  if (pending) return pending;
  const run = async () => {
    while (st.active >= CONCURRENCY) await new Promise((r) => setTimeout(r, 100));
    st.active++;
    try {
      const value = await lookupTerm(source, term, country);
      await cacheSet(cacheKey(country, term), { value } satisfies Cached, value == null ? MISS_TTL : TTL).catch(() => undefined);
      if (source.kind === "platform") await setPlatformSetting("ads.lastOkAt", new Date().toISOString()).catch(() => undefined);
      return value;
    } catch (error) {
      if (source.kind === "platform") await setPlatformSetting("ads.lastError", error instanceof Error ? error.message : String(error)).catch(() => undefined);
      return null;
    } finally {
      st.active--;
      st.pending.delete(key);
    }
  };
  const promise = run();
  st.pending.set(key, promise);
  return promise;
}

function cacheKey(country: string, term: string) {
  return `apple:popularity:v2:${country}:${term}`;
}

export async function applePopularity(term: string, country: string, workspaceId?: string | null): Promise<number | null> {
  const t = normalizeTerm(term);
  const c = getCountry(country).code;
  const hit = await cacheGet<Cached>(cacheKey(c, t));
  if (hit) return hit.value;
  const source = await popularitySource(workspaceId);
  if (!source) return null;
  return enqueue(source, c, t);
}

export async function platformCredentials() {
  const source = await platformSource();
  if (!source) return null;
  return { ...source.creds, publicKey: (await getPlatformSetting("ads.publicKey")) ?? null };
}

export async function platformStatus() {
  const [clientId, teamId, keyId, privateKey, publicKey, adAccountId, anchorAppId, lastError, lastOkAt] = await Promise.all([
    getPlatformSetting("ads.clientId"),
    getPlatformSetting("ads.teamId"),
    getPlatformSetting("ads.keyId"),
    getPlatformSetting("ads.privateKey"),
    getPlatformSetting("ads.publicKey"),
    getPlatformSetting("ads.adAccountId"),
    getPlatformSetting("ads.anchorAppId"),
    getPlatformSetting("ads.lastError"),
    getPlatformSetting("ads.lastOkAt"),
  ]);
  return {
    configured: !!(clientId && teamId && keyId && privateKey),
    hasKeyPair: !!privateKey,
    publicKey: publicKey ?? null,
    clientId: clientId ?? null,
    teamId: teamId ?? null,
    keyId: keyId ?? null,
    adAccountId: adAccountId ?? null,
    anchorAppId: anchorAppId ?? null,
    lastError: lastError ?? null,
    lastOkAt: lastOkAt ?? null,
  };
}

export async function generatePlatformKeys(force = false) {
  if (!force && (await getPlatformSetting("ads.privateKey"))) {
    return { publicKey: (await getPlatformSetting("ads.publicKey")) ?? createPublicKey(createPrivateKey((await getPlatformSetting("ads.privateKey"))!)).export({ type: "spki", format: "pem" }).toString() };
  }
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  await setPlatformSetting("ads.privateKey", privateKey);
  await setPlatformSetting("ads.publicKey", publicKey);
  state().tokens.clear();
  state().accounts.clear();
  return { publicKey };
}

export async function savePlatformIds(input: { clientId: string; teamId: string; keyId: string }) {
  await setPlatformSetting("ads.clientId", input.clientId.trim());
  await setPlatformSetting("ads.teamId", input.teamId.trim());
  await setPlatformSetting("ads.keyId", input.keyId.trim());
  await setPlatformSetting("ads.adAccountId", null);
  await setPlatformSetting("ads.anchorAppId", null);
  await setPlatformSetting("ads.lastError", null);
  state().tokens.clear();
  state().accounts.clear();
  state().anchors.clear();
}

export async function testPlatform(term = "photo editor", country = "us") {
  const source = await platformSource();
  if (!source) throw new HttpError(409, "Add the platform Apple Ads key first");
  await adAccount(source);
  const anchor = await anchorApp(source);
  const t = normalizeTerm(term);
  const popularity = await lookupTerm(source, t, getCountry(country).code);
  await setPlatformSetting("ads.lastError", null);
  await setPlatformSetting("ads.lastOkAt", new Date().toISOString());
  return { term: t, country, popularity, anchorAppId: anchor };
}

export async function probePlatform(path: string, payload?: unknown) {
  if (!/^\/(suggestions|insights)\/[\w/-]+$|^\/(acls|me)$/.test(path)) throw new HttpError(400, "Probe path not allowed");
  const source = await platformSource();
  if (!source) throw new HttpError(409, "Add the platform Apple Ads key first");
  const headers: Record<string, string> = { Authorization: `Bearer ${await token(source)}`, Accept: "application/json" };
  if (payload !== undefined) headers["Content-Type"] = "application/json";
  if (!/^\/(acls|me)$/.test(path)) headers["X-AP-Context"] = `adAccountId=${await adAccount(source)}`;
  const res = await fetch(`${BASE}${path}`, {
    method: payload === undefined ? "GET" : "POST",
    headers,
    body: payload === undefined ? undefined : JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  return { status: res.status, body: text.slice(0, 4000) };
}

export async function setAnchorApp(adamId: string) {
  await setPlatformSetting("ads.anchorAppId", adamId);
  state().anchors.clear();
}

export async function clearPlatform() {
  for (const k of ["ads.clientId", "ads.teamId", "ads.keyId", "ads.privateKey", "ads.publicKey", "ads.adAccountId", "ads.anchorAppId", "ads.lastError", "ads.lastOkAt"] as const)
    await setPlatformSetting(k, null);
  state().tokens.clear();
  state().accounts.clear();
}
