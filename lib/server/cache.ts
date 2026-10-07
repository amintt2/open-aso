import { db } from "./db";

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  const row = await db.get<{ value: T; expires_at: number }>("SELECT value, expires_at FROM cache WHERE key = ?", [key]);
  if (!row) return undefined;
  if (row.expires_at < Date.now()) {
    await db.run("DELETE FROM cache WHERE key = ?", [key]);
    return undefined;
  }
  return row.value;
}

export async function cacheSet(key: string, value: unknown, ttlMs: number) {
  await db.run(
    "INSERT INTO cache (key, value, expires_at) VALUES (?, ?::jsonb, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at",
    [key, JSON.stringify(value ?? null), Date.now() + ttlMs],
  );
}

export async function cacheDelete(prefix: string) {
  await db.run("DELETE FROM cache WHERE key LIKE ? || '%'", [prefix]);
}

const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, ttlMs: number | ((value: T) => number), load: () => Promise<T>): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== undefined) return hit;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const promise = load()
    .then(async (value) => {
      await cacheSet(key, value, typeof ttlMs === "function" ? ttlMs(value) : ttlMs);
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

export function wsKey(workspaceId: string, key: string) {
  return `ws:${workspaceId}:${key}`;
}

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;
