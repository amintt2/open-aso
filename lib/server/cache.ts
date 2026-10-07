import { db } from "./db";
import { currentWorkspaceId, isUntrusted, markUntrusted, trackTrust } from "./request-context";

function isScoped(key: string) {
  return key.startsWith("ws:");
}

async function readKey<T>(key: string): Promise<T | undefined> {
  const row = await db.get<{ value: T; expires_at: number }>("SELECT value, expires_at FROM cache WHERE key = ?", [key]);
  if (!row) return undefined;
  if (row.expires_at < Date.now()) {
    await db.run("DELETE FROM cache WHERE key = ?", [key]);
    return undefined;
  }
  return row.value;
}

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  const hit = await readKey<T>(key);
  if (hit !== undefined || isScoped(key)) return hit;
  const workspaceId = currentWorkspaceId();
  if (!workspaceId) return undefined;
  const scoped = await readKey<T>(wsKey(workspaceId, key));
  if (scoped !== undefined) markUntrusted();
  return scoped;
}

export async function cacheSet(key: string, value: unknown, ttlMs: number) {
  let target = key;
  if (!isScoped(key) && isUntrusted()) {
    const workspaceId = currentWorkspaceId();
    if (!workspaceId) return;
    target = wsKey(workspaceId, key);
  }
  await db.run(
    "INSERT INTO cache (key, value, expires_at) VALUES (?, ?::jsonb, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at",
    [target, JSON.stringify(value ?? null), Date.now() + ttlMs],
  );
}

export async function cacheGetMany<T>(keys: string[]): Promise<Map<string, T>> {
  const out = new Map<string, T>();
  const scoped = keys.filter(isScoped);
  if (scoped.length) {
    const rows = await db.all<{ key: string; value: T; expires_at: number }>("SELECT key, value, expires_at FROM cache WHERE key = ANY(?::text[])", [scoped]);
    const now = Date.now();
    for (const row of rows) if (row.expires_at >= now) out.set(row.key, row.value);
  }
  for (const key of keys.filter((k) => !isScoped(k))) {
    const hit = await cacheGet<T>(key);
    if (hit !== undefined) out.set(key, hit);
  }
  return out;
}

export async function cacheSetMany(entries: [string, unknown][], ttlMs: number) {
  const scoped = [...new Map(entries.filter(([key]) => isScoped(key)))];
  if (scoped.length)
    await db.run(
      `INSERT INTO cache (key, value, expires_at) SELECT k, v::jsonb, ? FROM unnest(?::text[], ?::text[]) AS t(k, v)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at`,
      [Date.now() + ttlMs, scoped.map(([key]) => key), scoped.map(([, value]) => JSON.stringify(value ?? null))],
    );
  for (const [key, value] of entries.filter(([k]) => !isScoped(k))) await cacheSet(key, value, ttlMs);
}

export async function cacheDelete(prefix: string) {
  await db.run("DELETE FROM cache WHERE key LIKE ? || '%'", [prefix]);
}

type Flight = { value: unknown; untrusted: boolean };

const inflight = new Map<string, Promise<Flight>>();

export async function cached<T>(key: string, ttlMs: number | ((value: T) => number), load: () => Promise<T>): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== undefined) return hit;
  const workspaceId = currentWorkspaceId();
  const flightKey = workspaceId && !isScoped(key) ? `${workspaceId}\u0000${key}` : key;
  let pending = inflight.get(flightKey);
  if (!pending) {
    pending = trackTrust(async () => {
      const value = await load();
      await cacheSet(key, value, typeof ttlMs === "function" ? ttlMs(value) : ttlMs);
      return value;
    })
      .then(({ value, untrusted }) => ({ value, untrusted }))
      .finally(() => inflight.delete(flightKey));
    inflight.set(flightKey, pending);
  }
  const result = await pending;
  if (result.untrusted) markUntrusted();
  return result.value as T;
}

export function wsKey(workspaceId: string, key: string) {
  return `ws:${workspaceId}:${key}`;
}

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;
