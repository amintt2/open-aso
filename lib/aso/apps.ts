import { db, parseJson } from "@/lib/server/db";
import { assertWithinLimit } from "@/lib/server/plans";
import { HttpError } from "@/lib/server/http";
import { artwork, lookupApp, type StoreApp } from "@/lib/appstore/itunes";

export type AppRow = {
  id: number;
  workspace_id: string;
  track_id: number;
  name: string;
  subtitle: string | null;
  icon_url: string | null;
  bundle_id: string | null;
  developer: string | null;
  primary_country: string;
  is_mine: boolean;
  asc_app_id: string | null;
  data: unknown;
  created_at: string;
};

export type TrackedApp = {
  id: number;
  workspaceId: string;
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
    workspaceId: row.workspace_id,
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

const SELECT = `SELECT a.*, (SELECT count(*) FROM keywords k WHERE k.app_id = a.id) AS keyword_count,
  (SELECT string_agg(DISTINCT k.country, ',') FROM keywords k WHERE k.app_id = a.id) AS countries FROM apps a`;

export async function listApps(workspaceId: string): Promise<TrackedApp[]> {
  return (await db.all<AppRow>(`${SELECT} WHERE a.workspace_id = ? ORDER BY a.created_at ASC`, [workspaceId])).map(toApp);
}

export async function getApp(workspaceId: string, id: number): Promise<TrackedApp> {
  const row = await db.get<AppRow>(`${SELECT} WHERE a.workspace_id = ? AND a.id = ?`, [workspaceId, id]);
  if (!row) throw new HttpError(404, "App not found");
  return toApp(row);
}

export async function getAppById(id: number): Promise<TrackedApp | undefined> {
  const row = await db.get<AppRow>(`${SELECT} WHERE a.id = ?`, [id]);
  return row ? toApp(row) : undefined;
}

export async function findAppByTrackId(workspaceId: string, trackId: number): Promise<TrackedApp | undefined> {
  const row = await db.get<AppRow>(`${SELECT} WHERE a.workspace_id = ? AND a.track_id = ?`, [workspaceId, trackId]);
  return row ? toApp(row) : undefined;
}

export async function findAppByBundleId(workspaceId: string, bundleId: string): Promise<TrackedApp | undefined> {
  const row = await db.get<AppRow>(`${SELECT} WHERE a.workspace_id = ? AND a.bundle_id = ?`, [workspaceId, bundleId]);
  return row ? toApp(row) : undefined;
}

export async function addApp(workspaceId: string, trackId: number, country: string, isMine = true): Promise<TrackedApp> {
  const existing = await findAppByTrackId(workspaceId, trackId);
  if (existing) return existing;
  await assertWithinLimit(workspaceId, "apps");
  const store = await lookupApp(trackId, country);
  if (!store) throw new HttpError(404, "App not found on the App Store in this country");
  const row = await db.get<{ id: number }>(
    "INSERT INTO apps (workspace_id, track_id, name, icon_url, bundle_id, developer, primary_country, is_mine, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb) RETURNING id",
    [
      workspaceId,
      store.trackId,
      store.trackName,
      artwork(store.artworkUrl512 ?? store.artworkUrl100, 256),
      store.bundleId,
      store.sellerName,
      country,
      isMine,
      JSON.stringify(store),
    ],
  );
  await recordVersion(store);
  return getApp(workspaceId, row!.id);
}

export async function refreshAppStoreData(workspaceId: string, id: number) {
  const app = await getApp(workspaceId, id);
  const store = await lookupApp(app.trackId, app.primaryCountry);
  if (!store) return app;
  await db.run("UPDATE apps SET name = ?, icon_url = ?, developer = ?, data = ?::jsonb WHERE id = ? AND workspace_id = ?", [
    store.trackName,
    artwork(store.artworkUrl512 ?? store.artworkUrl100, 256),
    store.sellerName,
    JSON.stringify(store),
    id,
    workspaceId,
  ]);
  await recordVersion(store);
  return getApp(workspaceId, id);
}

export async function updateApp(
  workspaceId: string,
  id: number,
  patch: { primaryCountry?: string; subtitle?: string | null; ascAppId?: string | null; isMine?: boolean },
) {
  await getApp(workspaceId, id);
  if (patch.primaryCountry !== undefined) await db.run("UPDATE apps SET primary_country = ? WHERE id = ?", [patch.primaryCountry, id]);
  if (patch.subtitle !== undefined) await db.run("UPDATE apps SET subtitle = ? WHERE id = ?", [patch.subtitle, id]);
  if (patch.ascAppId !== undefined) await db.run("UPDATE apps SET asc_app_id = ? WHERE id = ?", [patch.ascAppId, id]);
  if (patch.isMine !== undefined) await db.run("UPDATE apps SET is_mine = ? WHERE id = ?", [patch.isMine, id]);
  return getApp(workspaceId, id);
}

export async function deleteApp(workspaceId: string, id: number) {
  await db.run("DELETE FROM apps WHERE id = ? AND workspace_id = ?", [id, workspaceId]);
}

export async function recordVersion(store: Pick<StoreApp, "trackId" | "version" | "currentVersionReleaseDate">) {
  if (!store.version || !store.currentVersionReleaseDate) return;
  await db.run("INSERT INTO app_versions (track_id, version, released_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING", [
    store.trackId,
    store.version,
    store.currentVersionReleaseDate,
  ]);
}

export async function listVersions(trackId: number) {
  return db.all<{ version: string; releasedAt: string }>(
    `SELECT version, released_at AS "releasedAt" FROM app_versions WHERE track_id = ? ORDER BY released_at ASC`,
    [trackId],
  );
}
