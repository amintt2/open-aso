import { db } from "@/lib/server/db";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS ads_prefs (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ads_change_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id TEXT,
  action TEXT NOT NULL,
  payload TEXT NOT NULL,
  result TEXT,
  ok INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ads_impression_share (
  org_id TEXT NOT NULL,
  adam_id TEXT NOT NULL,
  country TEXT NOT NULL,
  search_term TEXT NOT NULL,
  date TEXT NOT NULL,
  low REAL,
  high REAL,
  rank TEXT,
  popularity INTEGER,
  PRIMARY KEY (org_id, adam_id, country, search_term, date)
);

CREATE TABLE IF NOT EXISTS ads_custom_reports (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  state TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  imported_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS ads_keyword_daily_org_date ON ads_keyword_daily(org_id, date);
`;

type GlobalWithFlag = typeof globalThis & { __openAsoAdsSchema?: boolean };

export function ensureSchema() {
  const g = globalThis as GlobalWithFlag;
  if (g.__openAsoAdsSchema) return db();
  db().exec(SCHEMA);
  g.__openAsoAdsSchema = true;
  return db();
}

export type AdsPrefKey = "targetCpa" | "lastError" | "lastCheckedAt" | "orgName" | "currency" | "orgs";

export function getPref(key: AdsPrefKey): string | undefined {
  const row = ensureSchema().prepare("SELECT value FROM ads_prefs WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value;
}

export function setPref(key: AdsPrefKey, value: string | null) {
  if (value === null || value === "") {
    ensureSchema().prepare("DELETE FROM ads_prefs WHERE key = ?").run(key);
    return;
  }
  ensureSchema()
    .prepare("INSERT INTO ads_prefs (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .run(key, value);
}

export function logChange(orgId: string | null, action: string, payload: unknown, result: unknown, ok: boolean) {
  ensureSchema()
    .prepare("INSERT INTO ads_change_log (org_id, action, payload, result, ok) VALUES (?, ?, ?, ?, ?)")
    .run(orgId, action, JSON.stringify(payload), JSON.stringify(result), ok ? 1 : 0);
}

export function recentChanges(limit = 50) {
  return ensureSchema()
    .prepare("SELECT id, org_id AS orgId, action, payload, result, ok, created_at AS createdAt FROM ads_change_log ORDER BY id DESC LIMIT ?")
    .all(limit) as { id: number; orgId: string | null; action: string; payload: string; result: string | null; ok: number; createdAt: string }[];
}

export function clearAdsCache() {
  ensureSchema().prepare("DELETE FROM cache WHERE key LIKE 'ads:%'").run();
}
