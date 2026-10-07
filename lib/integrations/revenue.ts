import { db } from "@/lib/server/db";

export type RevenueType =
  | "trial_started"
  | "trial_converted"
  | "initial_purchase"
  | "renewal"
  | "non_renewing_purchase"
  | "product_change"
  | "cancellation"
  | "uncancellation"
  | "refund"
  | "expiration"
  | "billing_issue"
  | "subscription_paused"
  | "transfer"
  | "test"
  | "other";

export type NormalizedRevenueEvent = {
  id: string;
  provider: "revenuecat" | "superwall";
  appId: number | null;
  userId: string | null;
  type: RevenueType;
  productId: string | null;
  amountUsd: number;
  country: string | null;
  occurredAt: string;
  environment: string | null;
  raw: unknown;
};

export async function candidateUser(
  workspaceId: string,
  ids: (string | null | undefined)[],
): Promise<{ userId: string | null; appId: number | null }> {
  const unique = [
    ...new Set(
      ids
        .filter(
          (v): v is string => typeof v === "string" && v.trim().length > 0,
        )
        .map((v) => v.trim()),
    ),
  ];
  if (!unique.length) return { userId: null, appId: null };
  for (const id of unique) {
    const row = await db.get<{ app_id: number | null }>(
      "SELECT app_id FROM installs WHERE workspace_id = ? AND user_id = ? ORDER BY installed_at DESC LIMIT 1",
      [workspaceId, id],
    );
    if (row) return { userId: id, appId: row.app_id };
  }
  return { userId: unique[0], appId: null };
}

export async function appIdFromRef(
  workspaceId: string,
  ref: string | null | undefined,
) {
  if (!ref) return null;
  const trimmed = ref.trim();
  const row = await db.get<{ id: number }>(
    "SELECT id FROM apps WHERE workspace_id = ? AND (bundle_id = ? OR track_id::text = ? OR id::text = ?) ORDER BY is_mine DESC, id ASC LIMIT 1",
    [workspaceId, trimmed, trimmed, trimmed],
  );
  return row?.id ?? null;
}

export async function soleOwnedAppId(workspaceId: string) {
  const rows = await db.all<{ id: number }>(
    "SELECT id FROM apps WHERE workspace_id = ? AND is_mine LIMIT 2",
    [workspaceId],
  );
  return rows.length === 1 ? rows[0].id : null;
}

export function normalizeCountry(value: unknown) {
  return typeof value === "string" && /^[a-zA-Z]{2}$/.test(value.trim())
    ? value.trim().toLowerCase()
    : null;
}

export function isoFromMs(value: unknown, fallback = Date.now()) {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  return new Date(Number.isFinite(n) && n > 0 ? n : fallback).toISOString();
}

export function roundUsd(value: number) {
  return Math.round(value * 10000) / 10000;
}

export async function saveRevenueEvent(
  workspaceId: string,
  event: NormalizedRevenueEvent,
): Promise<"inserted" | "duplicate"> {
  const changes = await db.run(
    `INSERT INTO revenue_events (workspace_id, id, provider, app_id, user_id, type, product_id, amount_usd, country, occurred_at, raw)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb) ON CONFLICT (workspace_id, id) DO NOTHING`,
    [
      workspaceId,
      event.id,
      event.provider,
      event.appId,
      event.userId,
      event.type,
      event.productId,
      roundUsd(event.amountUsd),
      event.country,
      event.occurredAt,
      JSON.stringify({ environment: event.environment, event: event.raw }),
    ],
  );
  return changes ? "inserted" : "duplicate";
}
