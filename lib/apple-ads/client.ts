import { getSetting } from "@/lib/server/settings";
import { HttpError } from "@/lib/server/http";
import { AppleAdsError, getAccessToken } from "./auth";

export const API_BASE = "https://api.searchads.apple.com/api/v5";

type ApiErrorBody = {
  error?: { errors?: { messageCode?: string; message?: string; field?: string }[] } | null;
  errors?: { messageCode?: string; message?: string; field?: string }[];
  message?: string;
};

export type Envelope<T> = { data: T; pagination?: { totalResults?: number; startIndex?: number; itemsPerPage?: number } | null };

type RequestOptions = {
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  orgScoped?: boolean;
};

function errorMessage(status: number, body: ApiErrorBody) {
  const items = body.error?.errors ?? body.errors ?? [];
  const parts = items
    .map((e) => [e.message, e.field && e.field !== "null" ? `(${e.field})` : null].filter(Boolean).join(" "))
    .filter(Boolean);
  if (parts.length) return { message: parts.join("; "), items };
  if (body.message) return { message: body.message, items };
  const fallback: Record<number, string> = {
    401: "Apple Ads rejected the access token. Reconnect and test the connection.",
    403: "This API user does not have permission for that action. It needs the API Account Manager role for this org.",
    404: "Apple Ads could not find that resource.",
    429: "Apple Ads rate limit reached. Try again in a minute.",
  };
  return { message: fallback[status] ?? `Apple Ads request failed (HTTP ${status})`, items };
}

export async function currentOrgId(workspaceId: string): Promise<string> {
  const orgId = await getSetting(workspaceId, "ads.orgId");
  if (!orgId) throw new HttpError(409, "Choose an Apple Ads organization in the connection settings.");
  return orgId;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function adsRequest<T>(workspaceId: string, method: "GET" | "POST" | "PUT" | "DELETE", path: string, opts: RequestOptions = {}): Promise<T> {
  const url = new URL(API_BASE + path);
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
  const orgScoped = opts.orgScoped !== false;
  const orgId = orgScoped ? await currentOrgId(workspaceId) : null;

  let refresh = false;
  for (let attempt = 0; attempt < 4; attempt++) {
    const token = await getAccessToken(workspaceId, refresh);
    refresh = false;
    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: "application/json" };
    if (orgId) headers["X-AP-Context"] = `orgId=${orgId}`;
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(url, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body), cache: "no-store" });
    if (res.status === 401 && attempt === 0) {
      refresh = true;
      continue;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await wait(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 800 * 2 ** attempt);
      continue;
    }
    const text = await res.text();
    let parsed: unknown = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      if (res.ok) throw new AppleAdsError(502, "Apple Ads returned a response that is not JSON.");
      parsed = { message: text.slice(0, 300) };
    }
    if (!res.ok) {
      const { message, items } = errorMessage(res.status, parsed as ApiErrorBody);
      throw new AppleAdsError(res.status, message, items);
    }
    return parsed as T;
  }
  throw new AppleAdsError(503, "Apple Ads did not respond after several retries.");
}

export async function listAll<T>(workspaceId: string, path: string, query: Record<string, string | number | undefined> = {}): Promise<T[]> {
  const limit = 1000;
  const out: T[] = [];
  for (let offset = 0; offset < 50_000; offset += limit) {
    const page = await adsRequest<Envelope<T[]>>(workspaceId, "GET", path, { query: { ...query, limit, offset } });
    const rows = page.data ?? [];
    out.push(...rows);
    const total = page.pagination?.totalResults ?? rows.length;
    if (rows.length < limit || out.length >= total) break;
  }
  return out;
}

export async function pool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await fn(items[index]);
      }
    }),
  );
  return results;
}
