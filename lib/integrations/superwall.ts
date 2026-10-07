import { createHmac } from "node:crypto";
import { z } from "zod";
import { HttpError } from "@/lib/server/http";
import { getSetting } from "@/lib/server/settings";
import { logIntegrationEvent } from "./log";
import { safeEqual } from "@/lib/server/crypto";
import {
  appIdFromRef,
  candidateUser,
  isoFromMs,
  normalizeCountry,
  saveRevenueEvent,
  soleOwnedAppId,
  type RevenueType,
} from "./revenue";

const TOLERANCE_SECONDS = 5 * 60;
const PURCHASE_TYPES = new Set<RevenueType>([
  "initial_purchase",
  "trial_started",
  "renewal",
  "trial_converted",
  "non_renewing_purchase",
]);

export function verifySvixSignature(
  headers: Headers,
  body: string,
  secret: string,
  now = Date.now(),
) {
  const id = headers.get("svix-id") ?? headers.get("webhook-id");
  const timestamp =
    headers.get("svix-timestamp") ?? headers.get("webhook-timestamp");
  const signatures =
    headers.get("svix-signature") ?? headers.get("webhook-signature");
  if (!id || !timestamp || !signatures)
    throw new HttpError(401, "Missing webhook signature headers");
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > TOLERANCE_SECONDS)
    throw new HttpError(401, "Webhook timestamp outside tolerance");
  const key = Buffer.from(
    secret.startsWith("whsec_") ? secret.slice(6) : secret,
    "base64",
  );
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  const valid = signatures
    .split(" ")
    .map((part) => part.split(","))
    .some(
      ([version, sig]) => version === "v1" && !!sig && safeEqual(sig, expected),
    );
  if (!valid) throw new HttpError(401, "Invalid webhook signature");
  return id;
}

const swData = z
  .object({
    id: z.string().min(1),
    name: z.string().optional(),
    productId: z.string().nullable().optional(),
    newProductId: z.string().nullable().optional(),
    price: z.number().nullable().optional(),
    priceInPurchasedCurrency: z.number().nullable().optional(),
    currencyCode: z.string().nullable().optional(),
    countryCode: z.string().nullable().optional(),
    originalAppUserId: z.string().nullable().optional(),
    appUserId: z.string().nullable().optional(),
    aliases: z.array(z.string()).nullable().optional(),
    userAttributes: z.record(z.string(), z.unknown()).nullable().optional(),
    bundleId: z.string().nullable().optional(),
    environment: z.string().nullable().optional(),
    periodType: z.string().nullable().optional(),
    purchasedAt: z.number().nullable().optional(),
    isTrialConversion: z.boolean().nullable().optional(),
    cancelReason: z.string().nullable().optional(),
  })
  .passthrough();

export const superwallWebhook = z
  .object({
    object: z.string().optional(),
    type: z.string().min(1),
    timestamp: z.number().optional(),
    data: swData,
  })
  .passthrough();

type SwData = z.infer<typeof swData>;

export function mapSuperwallType(
  type: string,
  data: SwData,
  amount: number,
): RevenueType {
  const t = type.toLowerCase();
  const trial = (data.periodType ?? "").toUpperCase() === "TRIAL";
  if (t === "test") return "test";
  if (t === "refund" || amount < 0) return "refund";
  switch (t) {
    case "initial_purchase":
      return trial ? "trial_started" : "initial_purchase";
    case "renewal":
      return data.isTrialConversion ? "trial_converted" : "renewal";
    case "non_renewing_purchase":
      return "non_renewing_purchase";
    case "product_change":
      return "product_change";
    case "cancellation":
      return (data.cancelReason ?? "").toUpperCase() === "CUSTOMER_SUPPORT"
        ? "refund"
        : "cancellation";
    case "uncancellation":
      return "uncancellation";
    case "expiration":
      return "expiration";
    case "billing_issue":
      return "billing_issue";
    case "subscription_paused":
      return "subscription_paused";
    default:
      return "other";
  }
}

function attr(data: SwData, ...keys: string[]) {
  for (const key of keys) {
    const v = data.userAttributes?.[key];
    if (typeof v === "string" && v) return v;
  }
  return null;
}

const WORKSPACE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export async function superwallSecret(workspaceId: string | null | undefined) {
  if (!workspaceId || !WORKSPACE_ID.test(workspaceId)) return null;
  return (
    (await getSetting(workspaceId, "integrations.superwall.secret")) ?? null
  );
}

export async function handleSuperwall(
  workspaceId: string | null,
  headers: Headers,
  rawBody: string,
) {
  if (!workspaceId)
    throw new HttpError(
      400,
      "Add ?w=<workspace id> to the webhook URL (copy it from the Integrations page)",
    );
  const secret = await superwallSecret(workspaceId);
  if (!secret)
    throw new HttpError(401, "Superwall is not configured for this workspace");
  try {
    verifySvixSignature(headers, rawBody, secret);
  } catch (error) {
    await logIntegrationEvent(
      workspaceId,
      "superwall",
      "error",
      null,
      error instanceof Error ? error.message : "Signature verification failed",
    );
    throw error;
  }
  const json = (() => {
    try {
      return JSON.parse(rawBody) as unknown;
    } catch {
      return null;
    }
  })();
  const parsed = superwallWebhook.safeParse(json);
  if (!parsed.success) {
    await logIntegrationEvent(
      workspaceId,
      "superwall",
      "error",
      null,
      "Malformed webhook payload",
    );
    throw new HttpError(400, "Malformed Superwall webhook payload");
  }
  const { type, data, timestamp } = parsed.data;
  const amount =
    typeof data.price === "number"
      ? data.price
      : (data.currencyCode ?? "").toUpperCase() === "USD" &&
          typeof data.priceInPurchasedCurrency === "number"
        ? data.priceInPurchasedCurrency
        : 0;
  const mapped = mapSuperwallType(type, data, amount);
  const user = await candidateUser(workspaceId, [
    attr(data, "openAsoId", "$openAsoId"),
    data.appUserId,
    data.originalAppUserId,
    ...(data.aliases ?? []),
  ]);
  const appId =
    (await appIdFromRef(workspaceId, data.bundleId)) ??
    user.appId ??
    (await soleOwnedAppId(workspaceId));
  const result = await saveRevenueEvent(workspaceId, {
    id: `sw_${data.id}`,
    provider: "superwall",
    appId,
    userId: user.userId,
    type: mapped,
    productId: data.newProductId ?? data.productId ?? null,
    amountUsd:
      mapped === "trial_started" ||
      mapped === "test" ||
      mapped === "cancellation"
        ? 0
        : amount,
    country: normalizeCountry(data.countryCode),
    occurredAt: isoFromMs(
      PURCHASE_TYPES.has(mapped)
        ? (data.purchasedAt ?? timestamp)
        : (timestamp ?? data.purchasedAt),
    ),
    environment: data.environment ?? null,
    raw: parsed.data,
  });
  await logIntegrationEvent(
    workspaceId,
    "superwall",
    result === "duplicate" ? "duplicate" : "ok",
    type,
    `${type}${amount ? ` · $${amount.toFixed(2)}` : ""}${user.userId ? ` · ${user.userId}` : ""}`,
    data.environment ?? null,
  );
  return {
    ok: true,
    id: data.id,
    type: mapped,
    duplicate: result === "duplicate",
  };
}
