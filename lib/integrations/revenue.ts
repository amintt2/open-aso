import { analyticsDb } from "@/lib/analytics/schema";

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

export function candidateUser(ids: (string | null | undefined)[]): { userId: string | null; appId: number | null } {
  const unique = [...new Set(ids.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim()))];
  if (!unique.length) return { userId: null, appId: null };
  const d = analyticsDb();
  const stmt = d.prepare("SELECT app_id FROM installs WHERE user_id = ? ORDER BY installed_at DESC LIMIT 1");
  for (const id of unique) {
    const row = stmt.get(id) as { app_id: number | null } | undefined;
    if (row) return { userId: id, appId: row.app_id };
  }
  return { userId: unique[0], appId: null };
}

export function appIdFromRef(ref: string | null | undefined) {
  if (!ref) return null;
  const trimmed = ref.trim();
  const row = analyticsDb()
    .prepare("SELECT id FROM apps WHERE bundle_id = ? OR CAST(track_id AS TEXT) = ? OR CAST(id AS TEXT) = ? ORDER BY is_mine DESC, id ASC LIMIT 1")
    .get(trimmed, trimmed, trimmed) as { id: number } | undefined;
  return row?.id ?? null;
}

export function normalizeCountry(value: unknown) {
  return typeof value === "string" && /^[a-zA-Z]{2}$/.test(value.trim()) ? value.trim().toLowerCase() : null;
}

export function isoFromMs(value: unknown, fallback = Date.now()) {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return new Date(Number.isFinite(n) && n > 0 ? n : fallback).toISOString();
}

export function roundUsd(value: number) {
  return Math.round(value * 10000) / 10000;
}

export function saveRevenueEvent(event: NormalizedRevenueEvent): "inserted" | "duplicate" {
  const info = analyticsDb()
    .prepare(
      `INSERT INTO revenue_events (id, provider, app_id, user_id, type, product_id, amount_usd, country, occurred_at, raw)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
    )
    .run(
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
    );
  return info.changes ? "inserted" : "duplicate";
}
