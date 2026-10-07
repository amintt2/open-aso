import { getApp, listApps } from "@/lib/aso/apps";
import { HttpError } from "@/lib/server/http";
import { parseJson } from "@/lib/server/db";
import { isoTime, MINUTE, num, runHogQL, text } from "./client";
import { canonicalEvent, inferPrefix, resolveRoles, roleEvents, roleOf } from "./events";
import { catalogQuery, discoverBundlesQuery, discoverPrefixesQuery, type AppScope } from "./hogql";
import { posthogDb } from "./schema";
import { EVENT_ROLES, type AppMapping, type DiscoveredBundle, type DiscoveredPrefix, type DiscoveryResult, type EventCatalogResult, type EventRole, type MappedTrackedApp, type PosthogApp } from "./types";

const DISCOVERY_TTL = 15 * MINUTE;
const CATALOG_TTL = 15 * MINUTE;

type MapRow = { app_id: number; bundle_id: string | null; prefix: string | null; auto: number; updated_at: string };

function toMapping(row: MapRow): AppMapping {
  return { appId: row.app_id, bundleId: row.bundle_id, prefix: row.prefix, auto: !!row.auto, updatedAt: row.updated_at };
}

export function cleanPrefix(value: string | null | undefined) {
  if (!value) return null;
  const v = value.trim().replace(/\.+$/, "");
  if (!v) return null;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(v)) throw new HttpError(400, "An event prefix may only contain letters, digits, - and _ (the text before the first dot)");
  return v;
}

export function cleanBundleId(value: string | null | undefined) {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  if (!/^[A-Za-z0-9.\-_]{1,255}$/.test(v)) throw new HttpError(400, "Invalid bundle id");
  return v;
}

export function listMappings(): AppMapping[] {
  return (posthogDb().prepare("SELECT * FROM posthog_app_map ORDER BY app_id").all() as MapRow[]).map(toMapping);
}

export function getMapping(appId: number): AppMapping | null {
  const row = posthogDb().prepare("SELECT * FROM posthog_app_map WHERE app_id = ?").get(appId) as MapRow | undefined;
  return row ? toMapping(row) : null;
}

export function setMapping(appId: number, input: { bundleId?: string | null; prefix?: string | null }, auto = false) {
  getApp(appId);
  const bundleId = cleanBundleId(input.bundleId);
  const prefix = cleanPrefix(input.prefix);
  if (!bundleId && !prefix) throw new HttpError(400, "Choose a bundle id or an event prefix");
  posthogDb()
    .prepare(
      `INSERT INTO posthog_app_map (app_id, bundle_id, prefix, auto, updated_at) VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
       ON CONFLICT(app_id) DO UPDATE SET bundle_id = excluded.bundle_id, prefix = excluded.prefix, auto = excluded.auto, updated_at = excluded.updated_at`,
    )
    .run(appId, bundleId, prefix, auto ? 1 : 0);
  return getMapping(appId) as AppMapping;
}

export function deleteMapping(appId: number) {
  posthogDb().prepare("DELETE FROM posthog_app_map WHERE app_id = ?").run(appId);
  posthogDb().prepare("DELETE FROM posthog_event_roles WHERE app_id = ?").run(appId);
}

export function getOverrides(appId: number): Partial<Record<EventRole, string[]>> {
  const rows = posthogDb().prepare("SELECT role, events FROM posthog_event_roles WHERE app_id = ?").all(appId) as { role: string; events: string }[];
  return Object.fromEntries(rows.filter((r) => (EVENT_ROLES as readonly string[]).includes(r.role)).map((r) => [r.role, parseJson<string[]>(r.events, [])]));
}

export function setOverride(appId: number, role: EventRole, events: string[] | null) {
  getApp(appId);
  if (events === null) {
    posthogDb().prepare("DELETE FROM posthog_event_roles WHERE app_id = ? AND role = ?").run(appId, role);
    return;
  }
  const clean = [...new Set(events.map((e) => e.trim()).filter((e) => e.length > 0 && e.length <= 200))].slice(0, 20);
  posthogDb()
    .prepare(
      `INSERT INTO posthog_event_roles (app_id, role, events, updated_at) VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
       ON CONFLICT(app_id, role) DO UPDATE SET events = excluded.events, updated_at = excluded.updated_at`,
    )
    .run(appId, role, JSON.stringify(clean));
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function suggestFor(app: { name: string; bundleId: string | null }, bundles: DiscoveredBundle[], prefixes: DiscoveredPrefix[]) {
  const bundle = app.bundleId ? bundles.find((b) => b.bundleId.toLowerCase() === app.bundleId?.toLowerCase()) : undefined;
  if (bundle) return { bundleId: bundle.bundleId, prefix: bundle.prefix };
  const words = app.name.split(/[\s:–—\-|]+/).map(slug).filter(Boolean);
  const name = slug(app.name);
  const prefix = prefixes.find((p) => {
    const s = slug(p.prefix);
    return s.length >= 3 && (s === name || s === words[0] || (app.bundleId ? app.bundleId.toLowerCase().split(".").includes(p.prefix.toLowerCase()) : false));
  });
  return prefix ? { bundleId: null, prefix: prefix.prefix } : null;
}

export async function discoverApps(opts: { refresh?: boolean } = {}): Promise<DiscoveryResult> {
  const [bundleRes, prefixRes] = await Promise.all([
    runHogQL<Record<string, unknown>>(discoverBundlesQuery(), { ttlMs: DISCOVERY_TTL, refresh: opts.refresh }),
    runHogQL<Record<string, unknown>>(discoverPrefixesQuery(), { ttlMs: DISCOVERY_TTL, refresh: opts.refresh }),
  ]);
  const prefixes: DiscoveredPrefix[] = prefixRes.rows
    .map((r) => ({ prefix: text(r.prefix) ?? "", events: num(r.total), users: num(r.users), lastSeen: isoTime(r.last_seen), bundleId: text(r.bundle_id), appName: text(r.app_name) }))
    .filter((p) => p.prefix);
  const bundles: DiscoveredBundle[] = bundleRes.rows
    .map((r) => {
      const bundleId = text(r.bundle_id) ?? "";
      const prefix = prefixes.filter((p) => p.bundleId === bundleId).sort((a, b) => b.events - a.events)[0]?.prefix ?? null;
      return { bundleId, appName: text(r.app_name), events: num(r.total), users: num(r.users), lastSeen: isoTime(r.last_seen), prefix };
    })
    .filter((b) => b.bundleId);
  const mappings = new Map(listMappings().map((m) => [m.appId, m]));
  const apps: MappedTrackedApp[] = listApps()
    .filter((a) => a.isMine)
    .map((a) => {
      const suggestion = suggestFor(a, bundles, prefixes);
      let mapping = mappings.get(a.id) ?? null;
      if (!mapping && suggestion?.bundleId) mapping = setMapping(a.id, suggestion, true);
      return { id: a.id, name: a.name, iconUrl: a.iconUrl, bundleId: a.bundleId, mapping, suggestion };
    });
  return { bundles, prefixes, apps, fetchedAt: bundleRes.fetchedAt < prefixRes.fetchedAt ? bundleRes.fetchedAt : prefixRes.fetchedAt, cached: bundleRes.cached && prefixRes.cached };
}

export function resolveTrackedApp(appId: number): { app: PosthogApp; scope: AppScope } {
  const tracked = getApp(appId);
  const mapping = getMapping(appId);
  if (!mapping) throw new HttpError(409, `${tracked.name} isn't mapped to PostHog yet. Pick its bundle id or event prefix on the Integrations page.`);
  return {
    app: { id: tracked.id, name: tracked.name, bundleId: mapping.bundleId, prefix: mapping.prefix, demoSlug: null },
    scope: { bundleId: mapping.bundleId, prefix: mapping.prefix },
  };
}

export async function appCatalog(appId: number, opts: { refresh?: boolean } = {}): Promise<EventCatalogResult> {
  const { app, scope } = resolveTrackedApp(appId);
  const res = await runHogQL<Record<string, unknown>>(catalogQuery(scope), { ttlMs: CATALOG_TTL, refresh: opts.refresh });
  const rows = res.rows.map((r) => ({ event: text(r.event) ?? "", count: num(r.total), users: num(r.users) })).filter((r) => r.event);
  return buildCatalog({ ...app, prefix: app.prefix ?? inferPrefix(rows) }, rows, getOverrides(appId), res.fetchedAt, res.cached);
}

export function buildCatalog(app: PosthogApp, rows: { event: string; count: number; users: number }[], overrides: Partial<Record<EventRole, string[]>>, fetchedAt: string, cached: boolean): EventCatalogResult {
  const roles = resolveRoles(
    rows.map((r) => r.event),
    app.prefix,
    overrides,
  );
  const map = roleEvents(roles);
  return {
    app,
    events: rows.map((r) => ({ ...r, canonical: canonicalEvent(r.event, app.prefix), role: roleOf(r.event, map) })),
    roles,
    fetchedAt,
    cached,
  };
}

export function mappedApps(): MappedTrackedApp[] {
  const mappings = new Map(listMappings().map((m) => [m.appId, m]));
  return listApps()
    .filter((a) => mappings.has(a.id))
    .map((a) => ({ id: a.id, name: a.name, iconUrl: a.iconUrl, bundleId: a.bundleId, mapping: mappings.get(a.id) ?? null, suggestion: null }));
}
