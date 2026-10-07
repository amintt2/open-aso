import { z } from "zod";
import { db } from "@/lib/server/db";
import { HttpError } from "@/lib/server/http";
import { findAppByBundleId, findAppByTrackId } from "@/lib/aso/apps";
import { logIntegrationEvent } from "@/lib/integrations/log";

const ADSERVICES_URL = "https://api-adservices.apple.com/api/v1/";
const RETRY_DELAY_MS = 5000;
const MAX_INLINE_ATTEMPTS = 3;
const MAX_TOTAL_ATTEMPTS = 12;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const idLike = z
  .union([z.string().trim().min(1).max(64), z.number().int()])
  .transform((v) => String(v));

export const attributionPayload = z.object({
  attribution: z.boolean().optional(),
  orgId: idLike.optional(),
  campaignId: idLike.optional(),
  adGroupId: idLike.optional(),
  keywordId: idLike.optional(),
  adId: idLike.optional(),
  countryOrRegion: z.string().trim().max(8).optional(),
  clickDate: z.string().max(40).optional(),
  impressionDate: z.string().max(40).optional(),
  claimType: z.string().max(40).optional(),
  conversionType: z.string().max(40).optional(),
});

export type AttributionPayload = z.infer<typeof attributionPayload>;

const appRef = {
  bundleId: z.string().trim().min(1).max(255).optional(),
  trackId: z
    .union([
      z.number().int().positive(),
      z.string().regex(/^\d+$/).transform(Number),
    ])
    .optional(),
};

export const installInput = z
  .object({
    ...appRef,
    userId: z.string().trim().min(1).max(200),
    adServicesToken: z.string().trim().min(16).max(4096).optional(),
    country: z.string().trim().max(8).optional(),
    city: z.string().trim().max(120).optional(),
    installedAt: z.iso.datetime({ offset: true }).optional(),
    attribution: attributionPayload.optional(),
  })
  .refine((v) => v.bundleId || v.trackId, {
    message: "bundleId or trackId is required",
    path: ["bundleId"],
  });

export const eventInput = z
  .object({
    ...appRef,
    userId: z.string().trim().min(1).max(200),
    name: z.string().trim().min(1).max(64).default("session"),
    at: z.iso.datetime({ offset: true }).optional(),
    country: z.string().trim().max(8).optional(),
    city: z.string().trim().max(120).optional(),
  })
  .refine((v) => v.bundleId || v.trackId, {
    message: "bundleId or trackId is required",
    path: ["bundleId"],
  });

export type InstallInput = z.infer<typeof installInput>;
export type EventInput = z.infer<typeof eventInput>;

export async function resolveAppId(
  workspaceId: string,
  ref: { bundleId?: string; trackId?: number },
): Promise<number> {
  const app =
    (ref.bundleId
      ? await findAppByBundleId(workspaceId, ref.bundleId)
      : undefined) ??
    (ref.trackId
      ? await findAppByTrackId(workspaceId, ref.trackId)
      : undefined);
  if (!app)
    throw new HttpError(
      404,
      `No tracked app matches ${ref.bundleId ?? ref.trackId}. Add the app in this Open ASO workspace first.`,
    );
  return app.id;
}

function normalizeCountry(value: string | undefined | null) {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  return /^[a-z]{2}$/.test(v) ? v : null;
}

function clampDate(iso: string | undefined) {
  const now = Date.now();
  if (!iso) return new Date(now);
  const t = Date.parse(iso);
  if (!Number.isFinite(t) || t > now + 5 * 60 * 1000) return new Date(now);
  return new Date(t);
}

export async function keywordText(
  workspaceId: string,
  keywordId: string | null | undefined,
) {
  if (!keywordId) return null;
  const row = await db.get<{ keyword: string }>(
    "SELECT keyword FROM ads_keyword_daily WHERE workspace_id = ? AND keyword_id = ? ORDER BY date DESC LIMIT 1",
    [workspaceId, keywordId],
  );
  return row?.keyword ?? null;
}

export async function applyAttribution(
  workspaceId: string,
  installId: number,
  record: AttributionPayload,
) {
  if (!record.attribution) return false;
  await db.run(
    `UPDATE installs SET source = 'apple_ads', campaign_id = COALESCE(?, campaign_id), ad_group_id = COALESCE(?, ad_group_id),
      keyword_id = COALESCE(?, keyword_id), keyword = COALESCE(?, keyword), country = COALESCE(country, ?) WHERE id = ? AND workspace_id = ?`,
    [
      record.campaignId ?? null,
      record.adGroupId ?? null,
      record.keywordId ?? null,
      await keywordText(workspaceId, record.keywordId),
      normalizeCountry(record.countryOrRegion),
      installId,
      workspaceId,
    ],
  );
  return true;
}

export type InstallResult = {
  installId: number;
  appId: number;
  source: string;
  attribution: "resolved" | "pending" | "none";
  created: boolean;
};

export async function recordInstall(
  workspaceId: string,
  input: InstallInput,
): Promise<InstallResult> {
  const appId = await resolveAppId(workspaceId, input);
  const install = await db.get<{
    id: number;
    source: string;
    created: boolean;
  }>(
    `INSERT INTO installs (workspace_id, app_id, user_id, country, city, installed_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (app_id, user_id) DO UPDATE SET country = COALESCE(excluded.country, installs.country), city = COALESCE(excluded.city, installs.city)
     RETURNING id, source, (xmax = 0) AS created`,
    [
      workspaceId,
      appId,
      input.userId,
      normalizeCountry(input.country),
      input.city || null,
      clampDate(input.installedAt).toISOString(),
    ],
  );
  if (!install) throw new HttpError(500, "Could not record the install");
  let attribution: InstallResult["attribution"] = "none";
  if (input.attribution?.attribution) {
    await applyAttribution(workspaceId, install.id, input.attribution);
    attribution = "resolved";
  } else if (input.adServicesToken && install.source !== "apple_ads") {
    await db.run(
      `INSERT INTO attribution_pending (install_id, workspace_id, token) VALUES (?, ?, ?)
       ON CONFLICT (install_id) DO UPDATE SET token = excluded.token, attempts = 0, status = 'pending', last_error = NULL, created_at = now(), updated_at = now()
       WHERE attribution_pending.status != 'resolved'`,
      [install.id, workspaceId, input.adServicesToken],
    );
    attribution = "pending";
  }
  const source =
    (
      await db.get<{ source: string }>(
        "SELECT source FROM installs WHERE id = ?",
        [install.id],
      )
    )?.source ?? install.source;
  await logIntegrationEvent(
    workspaceId,
    "sdk",
    install.created ? "ok" : "duplicate",
    "install",
    `${input.userId} · ${source}${attribution === "pending" ? " · AdServices pending" : ""}`,
  );
  return {
    installId: install.id,
    appId,
    source,
    attribution,
    created: install.created,
  };
}

export async function recordEvent(workspaceId: string, input: EventInput) {
  const appId = await resolveAppId(workspaceId, input);
  const at = clampDate(input.at);
  await db.run(
    "INSERT INTO installs (workspace_id, app_id, user_id, country, city, installed_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (app_id, user_id) DO NOTHING",
    [
      workspaceId,
      appId,
      input.userId,
      normalizeCountry(input.country),
      input.city || null,
      at.toISOString(),
    ],
  );
  await db.run(
    "INSERT INTO analytics_sessions (workspace_id, app_id, user_id, date) VALUES (?, ?, ?, ?) ON CONFLICT (app_id, user_id, date) DO UPDATE SET count = analytics_sessions.count + 1",
    [workspaceId, appId, input.userId, at.toISOString().slice(0, 10)],
  );
  return { appId };
}

type FetchOutcome =
  | { kind: "ok"; record: AttributionPayload }
  | { kind: "invalid" }
  | { kind: "notfound" }
  | { kind: "retry"; error: string };

export async function fetchAdServicesAttribution(
  token: string,
): Promise<FetchOutcome> {
  try {
    const res = await fetch(ADSERVICES_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: token,
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 200) {
      const parsed = attributionPayload.safeParse(await res.json());
      return parsed.success
        ? { kind: "ok", record: parsed.data }
        : { kind: "retry", error: "Unexpected AdServices payload" };
    }
    if (res.status === 400) return { kind: "invalid" };
    if (res.status === 404) return { kind: "notfound" };
    return { kind: "retry", error: `AdServices responded ${res.status}` };
  } catch (error) {
    return {
      kind: "retry",
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function markPending(
  installId: number,
  status: string,
  error: string | null,
  attempts: number,
) {
  await db.run(
    "UPDATE attribution_pending SET status = ?, last_error = ?, attempts = attempts + ?, updated_at = now() WHERE install_id = ?",
    [status, error, attempts, installId],
  );
}

async function attempt(
  workspaceId: string,
  installId: number,
  token: string,
  tries: number,
) {
  let last: FetchOutcome = { kind: "retry", error: "Not attempted" };
  let used = 0;
  for (let i = 0; i < tries; i++) {
    if (i > 0) await sleep(RETRY_DELAY_MS);
    used++;
    last = await fetchAdServicesAttribution(token);
    if (last.kind !== "notfound") break;
  }
  if (last.kind === "ok") {
    const attributed = await applyAttribution(
      workspaceId,
      installId,
      last.record,
    );
    await markPending(installId, "resolved", null, used);
    await logIntegrationEvent(
      workspaceId,
      "sdk",
      "ok",
      "adservices",
      attributed
        ? `Apple Ads install · keyword ${last.record.keywordId ?? "n/a"}`
        : "AdServices: not attributed (organic)",
    );
    return;
  }
  if (last.kind === "invalid") {
    await markPending(
      installId,
      "invalid",
      "AdServices rejected the token (400)",
      used,
    );
    await logIntegrationEvent(
      workspaceId,
      "sdk",
      "error",
      "adservices",
      "AdServices rejected the token (400)",
    );
    return;
  }
  await markPending(
    installId,
    "pending",
    last.kind === "notfound"
      ? "Attribution record not found yet (404)"
      : last.error,
    used,
  );
}

export async function resolvePendingAttribution(
  workspaceId: string,
  installId: number,
) {
  const row = await db.get<{ token: string }>(
    "SELECT token FROM attribution_pending WHERE install_id = ? AND workspace_id = ? AND status = 'pending'",
    [installId, workspaceId],
  );
  if (row)
    await attempt(workspaceId, installId, row.token, MAX_INLINE_ATTEMPTS);
}

export async function drainPendingAttribution(limit = 10) {
  await db.run(
    "UPDATE attribution_pending SET status = 'expired' WHERE status = 'pending' AND (created_at < ? OR attempts >= ?)",
    [new Date(Date.now() - TOKEN_TTL_MS).toISOString(), MAX_TOTAL_ATTEMPTS],
  );
  const rows = await db.all<{
    install_id: number;
    workspace_id: string;
    token: string;
  }>(
    "SELECT install_id, workspace_id, token FROM attribution_pending WHERE status = 'pending' AND updated_at < ? ORDER BY updated_at ASC LIMIT ?",
    [new Date(Date.now() - 60 * 1000).toISOString(), limit],
  );
  for (const row of rows)
    await attempt(row.workspace_id, row.install_id, row.token, 1);
}
