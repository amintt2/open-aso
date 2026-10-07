import type Database from "better-sqlite3";
import { db } from "@/lib/server/db";

export const POSTHOG_SCHEMA = `
CREATE TABLE IF NOT EXISTS posthog_app_map (
  app_id INTEGER PRIMARY KEY REFERENCES apps(id) ON DELETE CASCADE,
  bundle_id TEXT,
  prefix TEXT,
  auto INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS posthog_event_roles (
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  events TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (app_id, role)
);
`;

const initialized = new WeakSet<Database.Database>();

export function posthogDb(): Database.Database {
  const d = db();
  if (!initialized.has(d)) {
    d.exec(POSTHOG_SCHEMA);
    initialized.add(d);
  }
  return d;
}
