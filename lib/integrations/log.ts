import { db } from "@/lib/server/db";

export type IntegrationProvider = "revenuecat" | "superwall" | "sdk";
export type IntegrationEventStatus = "ok" | "error" | "duplicate" | "ignored";

export type IntegrationEvent = {
  id: number;
  provider: IntegrationProvider;
  status: IntegrationEventStatus;
  eventType: string | null;
  message: string | null;
  environment: string | null;
  receivedAt: string;
};

export type ProviderActivity = {
  lastEvent: IntegrationEvent | null;
  lastError: IntegrationEvent | null;
  events24h: number;
  errors24h: number;
};

const KEEP_PER_PROVIDER = 200;
let ready = false;

function ensureSchema() {
  if (ready) return;
  db().exec(`
    CREATE TABLE IF NOT EXISTS integration_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      event_type TEXT,
      message TEXT,
      environment TEXT,
      received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE INDEX IF NOT EXISTS integration_events_provider ON integration_events(provider, id DESC);
  `);
  ready = true;
}

type Row = { id: number; provider: IntegrationProvider; status: IntegrationEventStatus; event_type: string | null; message: string | null; environment: string | null; received_at: string };

function toEvent(row: Row): IntegrationEvent {
  return { id: row.id, provider: row.provider, status: row.status, eventType: row.event_type, message: row.message, environment: row.environment, receivedAt: row.received_at };
}

export function logIntegrationEvent(provider: IntegrationProvider, status: IntegrationEventStatus, eventType: string | null, message: string | null, environment: string | null = null) {
  ensureSchema();
  const d = db();
  d.prepare("INSERT INTO integration_events (provider, status, event_type, message, environment) VALUES (?, ?, ?, ?, ?)").run(provider, status, eventType, message?.slice(0, 500) ?? null, environment);
  d.prepare("DELETE FROM integration_events WHERE provider = ? AND id <= (SELECT id FROM integration_events WHERE provider = ? ORDER BY id DESC LIMIT 1 OFFSET ?)").run(provider, provider, KEEP_PER_PROVIDER);
}

export function recentIntegrationEvents(provider: IntegrationProvider, limit = 25): IntegrationEvent[] {
  ensureSchema();
  return (db().prepare("SELECT * FROM integration_events WHERE provider = ? ORDER BY id DESC LIMIT ?").all(provider, limit) as Row[]).map(toEvent);
}

export function providerActivity(provider: IntegrationProvider): ProviderActivity {
  ensureSchema();
  const d = db();
  const last = d.prepare("SELECT * FROM integration_events WHERE provider = ? AND status != 'error' ORDER BY id DESC LIMIT 1").get(provider) as Row | undefined;
  const lastError = d.prepare("SELECT * FROM integration_events WHERE provider = ? AND status = 'error' ORDER BY id DESC LIMIT 1").get(provider) as Row | undefined;
  const counts = d
    .prepare("SELECT COUNT(*) AS total, SUM(status = 'error') AS errors FROM integration_events WHERE provider = ? AND received_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')")
    .get(provider) as { total: number; errors: number | null };
  return {
    lastEvent: last ? toEvent(last) : null,
    lastError: lastError ? toEvent(lastError) : null,
    events24h: counts.total,
    errors24h: counts.errors ?? 0,
  };
}
