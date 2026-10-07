import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = process.env.OPEN_ASO_DATA_DIR ?? path.join(process.cwd(), ".data");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS apps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  subtitle TEXT,
  icon_url TEXT,
  bundle_id TEXT,
  developer TEXT,
  primary_country TEXT NOT NULL DEFAULT 'us',
  is_mine INTEGER NOT NULL DEFAULT 1,
  asc_app_id TEXT,
  data TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  country TEXT NOT NULL,
  notes TEXT,
  liked INTEGER NOT NULL DEFAULT 0,
  popularity REAL,
  difficulty REAL,
  position INTEGER,
  downloads_est REAL,
  top5_downloads REAL,
  top5_mrr REAL,
  label TEXT,
  results_count INTEGER,
  top_apps TEXT,
  last_refreshed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(app_id, term, country)
);
CREATE INDEX IF NOT EXISTS keywords_app_country ON keywords(app_id, country);

CREATE TABLE IF NOT EXISTS keyword_snapshots (
  keyword_id INTEGER NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  popularity REAL,
  difficulty REAL,
  position INTEGER,
  PRIMARY KEY (keyword_id, date)
);

CREATE TABLE IF NOT EXISTS app_versions (
  track_id INTEGER NOT NULL,
  version TEXT NOT NULL,
  released_at TEXT NOT NULL,
  PRIMARY KEY (track_id, version)
);

CREATE TABLE IF NOT EXISTS competitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  track_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  icon_url TEXT,
  developer TEXT,
  country TEXT NOT NULL DEFAULT 'us',
  data TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(app_id, track_id)
);

CREATE TABLE IF NOT EXISTS ads_keyword_daily (
  org_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  ad_group_id TEXT NOT NULL,
  keyword_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  country TEXT,
  date TEXT NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  taps INTEGER NOT NULL DEFAULT 0,
  installs INTEGER NOT NULL DEFAULT 0,
  spend REAL NOT NULL DEFAULT 0,
  currency TEXT,
  PRIMARY KEY (keyword_id, date)
);

CREATE TABLE IF NOT EXISTS installs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER REFERENCES apps(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  country TEXT,
  city TEXT,
  source TEXT NOT NULL DEFAULT 'organic',
  campaign_id TEXT,
  ad_group_id TEXT,
  keyword_id TEXT,
  keyword TEXT,
  installed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(app_id, user_id)
);

CREATE TABLE IF NOT EXISTS revenue_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  app_id INTEGER REFERENCES apps(id) ON DELETE CASCADE,
  user_id TEXT,
  type TEXT NOT NULL,
  product_id TEXT,
  amount_usd REAL NOT NULL DEFAULT 0,
  country TEXT,
  occurred_at TEXT NOT NULL,
  raw TEXT
);
CREATE INDEX IF NOT EXISTS revenue_events_user ON revenue_events(user_id);
`;

type GlobalWithDb = typeof globalThis & { __openAsoDb?: Database.Database };

export function db(): Database.Database {
  const g = globalThis as GlobalWithDb;
  if (g.__openAsoDb) return g.__openAsoDb;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const instance = new Database(path.join(DATA_DIR, "open-aso.sqlite"));
  instance.pragma("journal_mode = WAL");
  instance.pragma("foreign_keys = ON");
  instance.exec(SCHEMA);
  g.__openAsoDb = instance;
  return instance;
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
