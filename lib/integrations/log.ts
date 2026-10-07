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

type Row = {
  id: number;
  provider: IntegrationProvider;
  status: IntegrationEventStatus;
  event_type: string | null;
  message: string | null;
  environment: string | null;
  received_at: string;
};

function toEvent(row: Row): IntegrationEvent {
  return {
    id: row.id,
    provider: row.provider,
    status: row.status,
    eventType: row.event_type,
    message: row.message,
    environment: row.environment,
    receivedAt: row.received_at,
  };
}

export async function logIntegrationEvent(
  workspaceId: string,
  provider: IntegrationProvider,
  status: IntegrationEventStatus,
  eventType: string | null,
  message: string | null,
  environment: string | null = null,
) {
  await db.run(
    "INSERT INTO integration_events (workspace_id, provider, status, event_type, message, environment) VALUES (?, ?, ?, ?, ?, ?)",
    [
      workspaceId,
      provider,
      status,
      eventType,
      message?.slice(0, 500) ?? null,
      environment,
    ],
  );
  await db.run(
    `DELETE FROM integration_events WHERE workspace_id = ? AND provider = ? AND id <= (
       SELECT id FROM integration_events WHERE workspace_id = ? AND provider = ? ORDER BY id DESC LIMIT 1 OFFSET ?)`,
    [workspaceId, provider, workspaceId, provider, KEEP_PER_PROVIDER],
  );
}

export async function recentIntegrationEvents(
  workspaceId: string,
  provider: IntegrationProvider,
  limit = 25,
): Promise<IntegrationEvent[]> {
  return (
    await db.all<Row>(
      "SELECT * FROM integration_events WHERE workspace_id = ? AND provider = ? ORDER BY id DESC LIMIT ?",
      [workspaceId, provider, limit],
    )
  ).map(toEvent);
}

export async function providerActivity(
  workspaceId: string,
  provider: IntegrationProvider,
): Promise<ProviderActivity> {
  const [last, lastError, counts] = await Promise.all([
    db.get<Row>(
      "SELECT * FROM integration_events WHERE workspace_id = ? AND provider = ? AND status != 'error' ORDER BY id DESC LIMIT 1",
      [workspaceId, provider],
    ),
    db.get<Row>(
      "SELECT * FROM integration_events WHERE workspace_id = ? AND provider = ? AND status = 'error' ORDER BY id DESC LIMIT 1",
      [workspaceId, provider],
    ),
    db.get<{ total: number; errors: number }>(
      "SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'error') AS errors FROM integration_events WHERE workspace_id = ? AND provider = ? AND received_at >= now() - interval '1 day'",
      [workspaceId, provider],
    ),
  ]);
  return {
    lastEvent: last ? toEvent(last) : null,
    lastError: lastError ? toEvent(lastError) : null,
    events24h: counts?.total ?? 0,
    errors24h: counts?.errors ?? 0,
  };
}
