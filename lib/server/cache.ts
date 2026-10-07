import { db } from "./db";

export function cacheGet<T>(key: string): T | undefined {
  const row = db()
    .prepare("SELECT value, expires_at FROM cache WHERE key = ?")
    .get(key) as { value: string; expires_at: number } | undefined;
  if (!row) return undefined;
  if (row.expires_at < Date.now()) {
    db().prepare("DELETE FROM cache WHERE key = ?").run(key);
    return undefined;
  }
  return JSON.parse(row.value) as T;
}

export function cacheSet(key: string, value: unknown, ttlMs: number) {
  db()
    .prepare(
      "INSERT INTO cache (key, value, expires_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at",
    )
    .run(key, JSON.stringify(value), Date.now() + ttlMs);
}

const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return hit;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const promise = load()
    .then((value) => {
      cacheSet(key, value, ttlMs);
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;
