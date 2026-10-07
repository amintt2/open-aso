import { db, parseJson } from "@/lib/server/db";
import { HttpError } from "@/lib/server/http";
import { artwork, lookupApp, type StoreApp } from "@/lib/appstore/itunes";

export type AppRow = {
  id: number;
  track_id: number;
  name: string;
  subtitle: string | null;
  icon_url: string | null;
  bundle_id: string | null;
  developer: string | null;
  primary_country: string;
  is_mine: number;
  asc_app_id: string | null;
  data: string | null;
  created_at: string;
};

export type TrackedApp = {
  id: number;
  trackId: number;
  name: string;
  subtitle: string | null;
  iconUrl: string | null;
  bundleId: string | null;
  developer: string | null;
  primaryCountry: string;
  isMine: boolean;
  ascAppId: string | null;
  store: Partial<StoreApp>;
  keywordCount: number;
  countries: string[];
  createdAt: string;
};

function toApp(row: AppRow & { keyword_count?: number; countries?: string | null }): TrackedApp {
  return {
    id: row.id,
    trackId: row.track_id,
    name: row.name,
    subtitle: row.subtitle,
    iconUrl: row.icon_url,
    bundleId: row.bundle_id,
    developer: row.developer,
    primaryCountry: row.primary_country,
    isMine: !!row.is_mine,
    ascAppId: row.asc_app_id,
    store: parseJson<Partial<StoreApp>>(row.data, {}),
    keywordCount: row.keyword_count ?? 0,
    countries: row.countries ? row.countries.split(",") : [],
    createdAt: row.created_at,
  };
}

const SELECT = `SELECT a.*, (SELECT COUNT(*) FROM keywords k WHERE k.app_id = a.id) AS keyword_count,
  (SELECT GROUP_CONCAT(DISTINCT k.country) FROM keywords k WHERE k.app_id = a.id) AS countries FROM apps a`;

export function listApps(): TrackedApp[] {
  return (db().prepare(`${SELECT} ORDER BY a.created_at ASC`).all() as AppRow[]).map(toApp);
}

export function getApp(id: number): TrackedApp {
  const row = db().prepare(`${SELECT} WHERE a.id = ?`).get(id) as AppRow | undefined;
  if (!row) throw new HttpError(404, "App not found");
  return toApp(row);
}

export function findAppByTrackId(trackId: number): TrackedApp | undefined {
  const row = db().prepare(`${SELECT} WHERE a.track_id = ?`).get(trackId) as AppRow | undefined;
  return row ? toApp(row) : undefined;
}

export async function addApp(trackId: number, country: string, isMine = true): Promise<TrackedApp> {
  const existing = findAppByTrackId(trackId);
  if (existing) return existing;
  const store = await lookupApp(trackId, country);
  if (!store) throw new HttpError(404, "App not found on the App Store in this country");
  const info = db()
    .prepare(
      "INSERT INTO apps (track_id, name, icon_url, bundle_id, developer, primary_country, is_mine, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      store.trackId,
      store.trackName,
      artwork(store.artworkUrl512 ?? store.artworkUrl100, 256),
      store.bundleId,
      store.sellerName,
      country,
      isMine ? 1 : 0,
      JSON.stringify(store),
    );
  recordVersion(store);
  return getApp(Number(info.lastInsertRowid));
}

export async function refreshAppStoreData(id: number) {
  const app = getApp(id);
  const store = await lookupApp(app.trackId, app.primaryCountry);
  if (!store) return app;
  db()
    .prepare("UPDATE apps SET name = ?, icon_url = ?, developer = ?, data = ? WHERE id = ?")
    .run(store.trackName, artwork(store.artworkUrl512 ?? store.artworkUrl100, 256), store.sellerName, JSON.stringify(store), id);
  recordVersion(store);
  return getApp(id);
}

export function updateApp(id: number, patch: { primaryCountry?: string; subtitle?: string | null; ascAppId?: string | null; isMine?: boolean }) {
  getApp(id);
  if (patch.primaryCountry !== undefined) db().prepare("UPDATE apps SET primary_country = ? WHERE id = ?").run(patch.primaryCountry, id);
  if (patch.subtitle !== undefined) db().prepare("UPDATE apps SET subtitle = ? WHERE id = ?").run(patch.subtitle, id);
  if (patch.ascAppId !== undefined) db().prepare("UPDATE apps SET asc_app_id = ? WHERE id = ?").run(patch.ascAppId, id);
  if (patch.isMine !== undefined) db().prepare("UPDATE apps SET is_mine = ? WHERE id = ?").run(patch.isMine ? 1 : 0, id);
  return getApp(id);
}

export function deleteApp(id: number) {
  db().prepare("DELETE FROM apps WHERE id = ?").run(id);
}

export function recordVersion(store: Pick<StoreApp, "trackId" | "version" | "currentVersionReleaseDate">) {
  if (!store.version || !store.currentVersionReleaseDate) return;
  db()
    .prepare("INSERT OR IGNORE INTO app_versions (track_id, version, released_at) VALUES (?, ?, ?)")
    .run(store.trackId, store.version, store.currentVersionReleaseDate);
}

export function listVersions(trackId: number) {
  return db()
    .prepare("SELECT version, released_at AS releasedAt FROM app_versions WHERE track_id = ? ORDER BY released_at ASC")
    .all(trackId) as { version: string; releasedAt: string }[];
}
