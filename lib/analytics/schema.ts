import type Database from "better-sqlite3";
import { db } from "@/lib/server/db";

export const ANALYTICS_SCHEMA = `
CREATE TABLE IF NOT EXISTS analytics_sessions (
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (app_id, user_id, date)
);
CREATE INDEX IF NOT EXISTS analytics_sessions_date ON analytics_sessions(app_id, date);

CREATE TABLE IF NOT EXISTS attribution_pending (
  install_id INTEGER PRIMARY KEY REFERENCES installs(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS installs_app_date ON installs(app_id, installed_at);
CREATE INDEX IF NOT EXISTS installs_keyword ON installs(keyword_id);
CREATE INDEX IF NOT EXISTS installs_user ON installs(user_id);
CREATE INDEX IF NOT EXISTS ads_keyword_daily_campaign ON ads_keyword_daily(campaign_id, date);
CREATE INDEX IF NOT EXISTS revenue_events_app_date ON revenue_events(app_id, occurred_at);
`;

const initialized = new WeakSet<Database.Database>();

export function analyticsDb(): Database.Database {
  const d = db();
  if (!initialized.has(d)) {
    d.exec(ANALYTICS_SCHEMA);
    initialized.add(d);
  }
  return d;
}
