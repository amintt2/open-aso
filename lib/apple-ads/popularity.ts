import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync } from "node:crypto";
import { getCountry } from "@/lib/appstore/countries";
import { normalizeTerm } from "@/lib/aso/scoring";
import { cacheGet, cacheSet, DAY } from "@/lib/server/cache";
import { HttpError } from "@/lib/server/http";
import { getPlatformSetting, setPlatformSetting } from "@/lib/server/platform-settings";
import { getSettings } from "@/lib/server/settings";
import { createClientSecret, SCOPE, TOKEN_URL, type Credentials } from "./auth";

const BASE = "https://api.ads.apple.com/v1";
const BATCH = 50;
const TTL = 7 * DAY;
const MISS_TTL = 2 * DAY;

type Source = { kind: "workspace" | "platform"; id: string; creds: Credentials; adAccountId?: string };
type Cached = { value: number | null };

type GlobalState = {
  tokens: Map<string, { token: string; expiresAt: number }>;
  accounts: Map<string, string>;
  queues: Map<string, { terms: Map<string, ((v: number | null) => void)[]>; timer: ReturnType<typeof setTimeout> | null; source: Source; country: string }>;
};
type G = typeof globalThis & { __openAsoApplePop?: GlobalState };

function state(): GlobalState {
  const g = globalThis as G;
  g.__openAsoApplePop ??= { tokens: new Map(), accounts: new Map(), queues: new Map() };
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

function phraseBody(terms: string[], country: string | null) {
  const filters: { field: string; operator: string; value: string[] }[] = [
    { field: "queryType", operator: "EQUALS", value: ["SEARCH"] },
    { field: "phrase", operator: "IN", value: terms },
  ];
  if (country) filters.push({ field: "countriesOrRegions", operator: "IN", value: [country.toUpperCase()] });
  return { filters, pagination: { offset: 0, pageSize: Math.max(20, terms.length) } };
}

async function countryFilterMode(): Promise<"supported" | "unsupported" | "unknown"> {
  const v = await getPlatformSetting("ads.countryFilter");
  return v === "supported" || v === "unsupported" ? v : "unknown";
}

async function fetchBatch(source: Source, terms: string[], country: string): Promise<Map<string, number>> {
  let mode = await countryFilterMode();
  let data: { result?: { phrase?: string; popularity?: number }[] };
  if (mode !== "unsupported") {
    try {
      data = await api(source, "/suggestions/phrases/query", { method: "POST", body: phraseBody(terms, country) });
      if (mode === "unknown") await setPlatformSetting("ads.countryFilter", "supported");
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 400) throw error;
      await setPlatformSetting("ads.countryFilter", "unsupported");
      mode = "unsupported";
      data = { result: [] };
    }
  } else data = { result: [] };
  if (mode === "unsupported") {
    if (country !== "us") return new Map();
    data = await api(source, "/suggestions/phrases/query", { method: "POST", body: phraseBody(terms, null) });
  }
  const out = new Map<string, number>();
  for (const row of data.result ?? []) if (row.phrase && typeof row.popularity === "number") out.set(normalizeTerm(row.phrase), row.popularity);
  return out;
}

function enqueue(source: Source, country: string, term: string): Promise<number | null> {
  const st = state();
  const key = `${source.id}|${country}`;
  let q = st.queues.get(key);
  if (!q) {
    q = { terms: new Map(), timer: null, source, country };
    st.queues.set(key, q);
  }
  return new Promise((resolve) => {
    const waiters = q.terms.get(term) ?? [];
    waiters.push(resolve);
    q.terms.set(term, waiters);
    if (q.terms.size >= BATCH) void flush(key);
    else if (!q.timer) q.timer = setTimeout(() => void flush(key), 120);
  });
}

async function flush(key: string) {
  const st = state();
  const q = st.queues.get(key);
  if (!q) return;
  st.queues.delete(key);
  if (q.timer) clearTimeout(q.timer);
  const entries = [...q.terms.entries()];
  for (let i = 0; i < entries.length; i += BATCH) {
    const chunk = entries.slice(i, i + BATCH);
    let found = new Map<string, number>();
    let failed = false;
    try {
      found = await fetchBatch(q.source, chunk.map(([t]) => t), q.country);
      if (q.source.kind === "platform") await setPlatformSetting("ads.lastOkAt", new Date().toISOString());
    } catch (error) {
      failed = true;
      if (q.source.kind === "platform") await setPlatformSetting("ads.lastError", error instanceof Error ? error.message : String(error)).catch(() => undefined);
    }
    for (const [term, waiters] of chunk) {
      const value = failed ? null : (found.get(term) ?? null);
      if (!failed) await cacheSet(cacheKey(q.country, term), { value } satisfies Cached, value == null ? MISS_TTL : TTL).catch(() => undefined);
      waiters.forEach((w) => w(value));
    }
  }
}

function cacheKey(country: string, term: string) {
  return `apple:popularity:v1:${country}:${term}`;
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
  const [clientId, teamId, keyId, privateKey, publicKey, adAccountId, countryFilter, lastError, lastOkAt] = await Promise.all([
    getPlatformSetting("ads.clientId"),
    getPlatformSetting("ads.teamId"),
    getPlatformSetting("ads.keyId"),
    getPlatformSetting("ads.privateKey"),
    getPlatformSetting("ads.publicKey"),
    getPlatformSetting("ads.adAccountId"),
    getPlatformSetting("ads.countryFilter"),
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
    countryFilter: countryFilter ?? "unknown",
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
  await setPlatformSetting("ads.countryFilter", null);
  await setPlatformSetting("ads.lastError", null);
  state().tokens.clear();
  state().accounts.clear();
}

export async function testPlatform(term = "photo editor", country = "us") {
  const source = await platformSource();
  if (!source) throw new HttpError(409, "Add the platform Apple Ads key first");
  await adAccount(source);
  const found = await fetchBatch(source, [normalizeTerm(term)], country);
  await setPlatformSetting("ads.lastError", null);
  await setPlatformSetting("ads.lastOkAt", new Date().toISOString());
  return { term, country, popularity: found.get(normalizeTerm(term)) ?? null, countryFilter: await countryFilterMode() };
}

export async function clearPlatform() {
  for (const k of ["ads.clientId", "ads.teamId", "ads.keyId", "ads.privateKey", "ads.publicKey", "ads.adAccountId", "ads.countryFilter", "ads.lastError", "ads.lastOkAt"] as const)
    await setPlatformSetting(k, null);
  state().tokens.clear();
  state().accounts.clear();
}
