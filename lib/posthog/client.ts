import { createHash } from "node:crypto";
import { cacheDelete, cacheGet, cacheSet, wsKey } from "@/lib/server/cache";
import { HttpError } from "@/lib/server/http";
import { getSetting, setSetting } from "@/lib/server/settings";
import { maskSecret } from "@/lib/integrations/secrets";
import { connectionTestQuery, type HogQL } from "./hogql";
import type {
  PosthogConnectionCheck,
  PosthogRegion,
  PosthogStatus,
} from "./types";

export const REGION_HOSTS: Record<Exclude<PosthogRegion, "custom">, string> = {
  us: "https://us.posthog.com",
  eu: "https://eu.posthog.com",
};

export const MINUTE = 60 * 1000;
export const QUERY_TTL = 10 * MINUTE;

const MAX_CONCURRENT = 2;
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_RETRY_WAIT_S = 10;

export type PosthogCredentials = {
  host: string;
  projectId: string;
  apiKey: string;
};

export type QueryResult<T> = { rows: T[]; fetchedAt: string; cached: boolean };

export type QueryOptions = {
  ttlMs?: number;
  refresh?: boolean;
  credentials?: PosthogCredentials;
};

export class PosthogError extends HttpError {}

export function normalizeHost(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new PosthogError(
      400,
      "Enter a full PostHog URL, e.g. https://posthog.example.com",
    );
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new PosthogError(400, "The PostHog URL must start with https://");
  if (url.username || url.password || url.search || url.hash)
    throw new PosthogError(
      400,
      "The PostHog URL must not contain credentials, a query or a fragment",
    );
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

export function regionOf(
  host: string | null | undefined,
): PosthogRegion | null {
  if (!host) return null;
  return host === REGION_HOSTS.us
    ? "us"
    : host === REGION_HOSTS.eu
      ? "eu"
      : "custom";
}

export function validateApiKey(key: string) {
  const value = key.trim();
  if (value.startsWith("phc_"))
    throw new PosthogError(
      400,
      "That is a project API key (phc_…). Create a personal API key (phx_…) with the query:read scope.",
    );
  if (!/^[A-Za-z0-9_-]{16,200}$/.test(value))
    throw new PosthogError(
      400,
      "That doesn't look like a PostHog personal API key (phx_…).",
    );
  return value;
}

export function validateProjectId(id: string) {
  const value = id.trim();
  if (!/^\d{1,12}$/.test(value))
    throw new PosthogError(
      400,
      "The project ID is the number in your PostHog URL (/project/12345).",
    );
  return value;
}

export async function getCredentials(
  workspaceId: string,
): Promise<PosthogCredentials | null> {
  const [host, projectId, apiKey] = await Promise.all([
    getSetting(workspaceId, "posthog.host"),
    getSetting(workspaceId, "posthog.projectId"),
    getSetting(workspaceId, "posthog.apiKey"),
  ]);
  return host && projectId && apiKey ? { host, projectId, apiKey } : null;
}

export async function requireCredentials(workspaceId: string) {
  const credentials = await getCredentials(workspaceId);
  if (!credentials)
    throw new PosthogError(
      409,
      "PostHog is not connected. Add your host, project ID and personal API key on the Integrations page.",
    );
  return credentials;
}

export async function isPosthogConfigured(workspaceId: string) {
  return (await getCredentials(workspaceId)) !== null;
}

export async function clearPosthogCache(workspaceId: string) {
  await cacheDelete(wsKey(workspaceId, "posthog:"));
}

type GlobalWithQueue = typeof globalThis & {
  __openAsoPosthogQueue?: { active: number; waiting: (() => void)[] };
  __openAsoPosthogInflight?: Map<string, Promise<unknown>>;
};

function queue() {
  const g = globalThis as GlobalWithQueue;
  g.__openAsoPosthogQueue ??= { active: 0, waiting: [] };
  return g.__openAsoPosthogQueue;
}

function inflight() {
  const g = globalThis as GlobalWithQueue;
  g.__openAsoPosthogInflight ??= new Map();
  return g.__openAsoPosthogInflight;
}

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  const q = queue();
  if (q.active >= MAX_CONCURRENT)
    await new Promise<void>((resolve) => q.waiting.push(resolve));
  q.active++;
  try {
    return await fn();
  } finally {
    q.active--;
    q.waiting.shift()?.();
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function errorDetail(body: unknown) {
  if (body && typeof body === "object") {
    const b = body as {
      detail?: unknown;
      error?: unknown;
      message?: unknown;
      code?: unknown;
    };
    for (const value of [b.detail, b.error, b.message])
      if (typeof value === "string" && value) return value;
  }
  return null;
}

function failure(
  status: number,
  body: unknown,
  credentials: PosthogCredentials,
  retryAfter: string | null,
) {
  const detail = errorDetail(body);
  const code =
    body && typeof body === "object"
      ? String((body as { code?: unknown }).code ?? "")
      : "";
  const type =
    body && typeof body === "object"
      ? String((body as { type?: unknown }).type ?? "")
      : "";
  if (
    status === 401 ||
    type === "authentication_error" ||
    code === "authentication_failed"
  )
    return new PosthogError(
      502,
      `PostHog rejected the API key${detail ? ` (${detail})` : ""}. Use a personal API key (phx_…) from Settings → Personal API keys.`,
    );
  if (status === 403) {
    if (/scope/i.test(detail ?? "") || code === "permission_denied")
      return new PosthogError(
        502,
        `The personal API key can't run queries${detail ? ` (${detail})` : ""}. Give it the query:read scope and access to project ${credentials.projectId}.`,
      );
    return new PosthogError(
      502,
      `The personal API key has no access to project ${credentials.projectId}${detail ? ` (${detail})` : ""}.`,
    );
  }
  if (status === 404)
    return new PosthogError(
      502,
      `Project ${credentials.projectId} wasn't found on ${credentials.host}. Check the project ID and the region (US or EU Cloud).`,
    );
  if (status === 429) {
    const wait = Number(retryAfter);
    return new PosthogError(
      429,
      `PostHog's query rate limit was reached${Number.isFinite(wait) && wait > 0 ? `, try again in ${Math.ceil(wait)}s` : ""}. Results are cached for 10 minutes to stay under it.`,
    );
  }
  if (status === 400)
    return new PosthogError(
      400,
      `PostHog couldn't run the query: ${detail ?? "invalid query"}`,
    );
  return new PosthogError(
    502,
    `PostHog responded ${status}${detail ? `: ${detail}` : ""}`,
  );
}

type RawResponse = {
  results?: unknown[][];
  columns?: string[];
  error?: unknown;
};

async function execute(
  q: HogQL,
  credentials: PosthogCredentials,
  force: boolean,
): Promise<Record<string, unknown>[]> {
  const url = `${credentials.host}/api/projects/${encodeURIComponent(credentials.projectId)}/query/`;
  const payload = JSON.stringify({
    query: { kind: "HogQLQuery", query: q.query, values: q.values },
    name: q.name,
    refresh: force ? "force_blocking" : "blocking",
  });
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await withSlot(() =>
        fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${credentials.apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: payload,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          cache: "no-store",
        }),
      );
    } catch (error) {
      const reason =
        error instanceof Error && error.name === "TimeoutError"
          ? "timed out"
          : "is unreachable";
      throw new PosthogError(
        502,
        `PostHog at ${credentials.host} ${reason}. Check the host and your network.`,
      );
    }
    const body = (await res.json().catch(() => null)) as RawResponse | null;
    if (res.status === 429 && attempt === 0) {
      const wait = Number(res.headers.get("retry-after"));
      if (Number.isFinite(wait) && wait > 0 && wait <= MAX_RETRY_WAIT_S) {
        await sleep(wait * 1000);
        continue;
      }
    }
    if (!res.ok)
      throw failure(
        res.status,
        body,
        credentials,
        res.headers.get("retry-after"),
      );
    if (!body || !Array.isArray(body.results))
      throw new PosthogError(
        502,
        errorDetail(body) ?? "PostHog returned an unexpected response",
      );
    const columns = Array.isArray(body.columns) ? body.columns.map(String) : [];
    return body.results.map((row) =>
      Object.fromEntries(
        columns.map((column, i) => [
          column,
          Array.isArray(row) ? row[i] : null,
        ]),
      ),
    );
  }
}

function cacheKey(
  workspaceId: string,
  q: HogQL,
  credentials: PosthogCredentials,
) {
  const hash = createHash("sha256")
    .update(
      JSON.stringify([
        credentials.host,
        credentials.projectId,
        credentials.apiKey.slice(-6),
        q.query,
        q.values,
      ]),
    )
    .digest("hex")
    .slice(0, 40);
  return wsKey(workspaceId, `posthog:q:${credentials.projectId}:${hash}`);
}

export async function runHogQL<T>(
  workspaceId: string,
  q: HogQL,
  opts: QueryOptions = {},
): Promise<QueryResult<T>> {
  const credentials =
    opts.credentials ?? (await requireCredentials(workspaceId));
  const key = cacheKey(workspaceId, q, credentials);
  if (!opts.refresh) {
    const hit = await cacheGet<{ rows: T[]; fetchedAt: string }>(key);
    if (hit) return { ...hit, cached: true };
  }
  const pending = inflight().get(key);
  if (pending) return pending as Promise<QueryResult<T>>;
  const promise = execute(q, credentials, !!opts.refresh)
    .then(async (rows) => {
      const entry = { rows: rows as T[], fetchedAt: new Date().toISOString() };
      if ((opts.ttlMs ?? QUERY_TTL) > 0)
        await cacheSet(key, entry, opts.ttlMs ?? QUERY_TTL);
      return { ...entry, cached: false };
    })
    .finally(() => inflight().delete(key));
  inflight().set(key, promise);
  return promise;
}

export async function testConnection(
  workspaceId: string,
  credentials: PosthogCredentials,
): Promise<PosthogConnectionCheck> {
  const { rows } = await runHogQL<{ total: unknown }>(
    workspaceId,
    connectionTestQuery(),
    { credentials, ttlMs: 0, refresh: true },
  );
  return {
    ok: true,
    eventsLast24h: Number(rows[0]?.total ?? 0),
    checkedAt: new Date().toISOString(),
  };
}

export type CredentialsInput = {
  region: PosthogRegion;
  host?: string | null;
  projectId: string;
  apiKey?: string | null;
};

export async function saveCredentials(
  workspaceId: string,
  input: CredentialsInput,
) {
  const host =
    input.region === "custom"
      ? normalizeHost(input.host ?? "")
      : REGION_HOSTS[input.region];
  const projectId = validateProjectId(input.projectId);
  const existing = await getSetting(workspaceId, "posthog.apiKey");
  const apiKey = input.apiKey?.trim() ? validateApiKey(input.apiKey) : existing;
  if (!apiKey)
    throw new PosthogError(
      400,
      "Paste a personal API key (phx_…) with the query:read scope.",
    );
  const check = await testConnection(workspaceId, { host, projectId, apiKey });
  await setSetting(workspaceId, "posthog.host", host);
  await setSetting(workspaceId, "posthog.projectId", projectId);
  await setSetting(workspaceId, "posthog.apiKey", apiKey);
  await clearPosthogCache(workspaceId);
  return check;
}

export async function removeCredentials(workspaceId: string) {
  await setSetting(workspaceId, "posthog.host", null);
  await setSetting(workspaceId, "posthog.projectId", null);
  await setSetting(workspaceId, "posthog.apiKey", null);
  await clearPosthogCache(workspaceId);
}

export async function credentialStatus(
  workspaceId: string,
): Promise<Omit<PosthogStatus, "mappedApps">> {
  const [host, projectId, apiKey] = await Promise.all([
    getSetting(workspaceId, "posthog.host"),
    getSetting(workspaceId, "posthog.projectId"),
    getSetting(workspaceId, "posthog.apiKey"),
  ]);
  return {
    configured: !!(host && projectId && apiKey),
    region: regionOf(host),
    host: host ?? null,
    projectId: projectId ?? null,
    keyHint: maskSecret(apiKey),
  };
}

export function num(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function text(value: unknown) {
  if (value === null || value === undefined) return null;
  const s = String(value);
  return s === "" ? null : s;
}

export function isoTime(value: unknown) {
  const s = text(value);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : s;
}

export function isoDate(value: unknown) {
  const s = text(value);
  return s ? s.slice(0, 10) : null;
}
