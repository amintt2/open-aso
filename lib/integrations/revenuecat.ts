import { z } from "zod";
import { HttpError } from "@/lib/server/http";
import { logIntegrationEvent } from "./log";
import {
  appIdFromRef,
  candidateUser,
  isoFromMs,
  normalizeCountry,
  saveRevenueEvent,
  soleOwnedAppId,
  type RevenueType,
} from "./revenue";

const attributeValue = z
  .object({ value: z.string().nullable().optional() })
  .passthrough();

const rcEvent = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
    app_user_id: z.string().nullable().optional(),
    original_app_user_id: z.string().nullable().optional(),
    aliases: z.array(z.string()).nullable().optional(),
    product_id: z.string().nullable().optional(),
    new_product_id: z.string().nullable().optional(),
    period_type: z.string().nullable().optional(),
    price: z.number().nullable().optional(),
    price_in_purchased_currency: z.number().nullable().optional(),
    currency: z.string().nullable().optional(),
    country_code: z.string().nullable().optional(),
    event_timestamp_ms: z.number().nullable().optional(),
    purchased_at_ms: z.number().nullable().optional(),
    environment: z.string().nullable().optional(),
    cancel_reason: z.string().nullable().optional(),
    is_trial_conversion: z.boolean().nullable().optional(),
    subscriber_attributes: z
      .record(z.string(), attributeValue)
      .nullable()
      .optional(),
  })
  .passthrough();

export const revenueCatWebhook = z
  .object({ api_version: z.string().optional(), event: rcEvent })
  .passthrough();

type RcEvent = z.infer<typeof rcEvent>;

function usdAmount(event: RcEvent) {
  if (typeof event.price === "number") return event.price;
  if (
    typeof event.price_in_purchased_currency === "number" &&
    (event.currency ?? "").toUpperCase() === "USD"
  )
    return event.price_in_purchased_currency;
  return 0;
}

export function mapRevenueCatType(event: RcEvent, amount: number): RevenueType {
  const type = event.type.toUpperCase();
  const trial = (event.period_type ?? "").toUpperCase() === "TRIAL";
  if (type === "TEST") return "test";
  if (type === "REFUND" || amount < 0) return "refund";
  switch (type) {
    case "INITIAL_PURCHASE":
      return trial ? "trial_started" : "initial_purchase";
    case "RENEWAL":
      return event.is_trial_conversion ? "trial_converted" : "renewal";
    case "NON_RENEWING_PURCHASE":
      return "non_renewing_purchase";
    case "PRODUCT_CHANGE":
      return "product_change";
    case "CANCELLATION":
      return (event.cancel_reason ?? "").toUpperCase() === "CUSTOMER_SUPPORT"
        ? "refund"
        : "cancellation";
    case "UNCANCELLATION":
      return "uncancellation";
    case "EXPIRATION":
      return "expiration";
    case "BILLING_ISSUE":
      return "billing_issue";
    case "SUBSCRIPTION_PAUSED":
      return "subscription_paused";
    case "TRANSFER":
      return "transfer";
    default:
      return "other";
  }
}

function attribute(event: RcEvent, ...keys: string[]) {
  for (const key of keys) {
    const v = event.subscriber_attributes?.[key]?.value;
    if (v) return v;
  }
  return null;
}

export async function handleRevenueCat(
  workspaceId: string,
  payload: unknown,
  appRef: string | null,
) {
  const parsed = revenueCatWebhook.safeParse(payload);
  if (!parsed.success) {
    await logIntegrationEvent(
      workspaceId,
      "revenuecat",
      "error",
      null,
      "Malformed webhook payload",
    );
    throw new HttpError(400, "Malformed RevenueCat webhook payload");
  }
  const event = parsed.data.event;
  const amount = usdAmount(event);
  const type = mapRevenueCatType(event, amount);
  const user = await candidateUser(workspaceId, [
    attribute(event, "$openAsoId", "openAsoId"),
    event.app_user_id,
    event.original_app_user_id,
    ...(event.aliases ?? []),
  ]);
  const appId =
    (await appIdFromRef(workspaceId, appRef)) ??
    user.appId ??
    (await soleOwnedAppId(workspaceId));
  const occurredAt = isoFromMs(
    [
      "initial_purchase",
      "trial_started",
      "renewal",
      "trial_converted",
      "non_renewing_purchase",
    ].includes(type)
      ? (event.purchased_at_ms ?? event.event_timestamp_ms)
      : event.event_timestamp_ms,
  );
  const result = await saveRevenueEvent(workspaceId, {
    id: `rc_${event.id}`,
    provider: "revenuecat",
    appId,
    userId: user.userId,
    type,
    productId: event.new_product_id ?? event.product_id ?? null,
    amountUsd:
      type === "trial_started" || type === "test" || type === "cancellation"
        ? 0
        : amount,
    country: normalizeCountry(event.country_code),
    occurredAt,
    environment: event.environment ?? null,
    raw: event,
  });
  const label =
    type === "test"
      ? "Test event received"
      : `${event.type}${amount ? ` · $${amount.toFixed(2)}` : ""}${user.userId ? ` · ${user.userId}` : ""}`;
  await logIntegrationEvent(
    workspaceId,
    "revenuecat",
    result === "duplicate" ? "duplicate" : "ok",
    event.type,
    label,
    event.environment ?? null,
  );
  return { ok: true, id: event.id, type, duplicate: result === "duplicate" };
}
