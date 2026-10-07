import { z } from "zod";
import { HttpError } from "@/lib/server/http";
import { logIntegrationEvent } from "@/lib/integrations/log";
import { analyticsDb } from "./schema";

const ADSERVICES_URL = "https://api-adservices.apple.com/api/v1/";
const RETRY_DELAY_MS = 5000;
const MAX_INLINE_ATTEMPTS = 3;
const MAX_TOTAL_ATTEMPTS = 12;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const idLike = z.union([z.string().trim().min(1).max(64), z.number().int()]).transform((v) => String(v));

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
  trackId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]).optional(),
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
  .refine((v) => v.bundleId || v.trackId, { message: "bundleId or trackId is required", path: ["bundleId"] });

export const eventInput = z
  .object({
    ...appRef,
    userId: z.string().trim().min(1).max(200),
    name: z.string().trim().min(1).max(64).default("session"),
    at: z.iso.datetime({ offset: true }).optional(),
    country: z.string().trim().max(8).optional(),
    city: z.string().trim().max(120).optional(),
  })
  .refine((v) => v.bundleId || v.trackId, { message: "bundleId or trackId is required", path: ["bundleId"] });

export type InstallInput = z.infer<typeof installInput>;
export type EventInput = z.infer<typeof eventInput>;

export function resolveAppId(ref: { bundleId?: string; trackId?: number }): number {
  const row = analyticsDb()
    .prepare("SELECT id FROM apps WHERE (? IS NOT NULL AND bundle_id = ?) OR (? IS NOT NULL AND track_id = ?) ORDER BY is_mine DESC, id ASC LIMIT 1")
    .get(ref.bundleId ?? null, ref.bundleId ?? null, ref.trackId ?? null, ref.trackId ?? null) as { id: number } | undefined;
  if (!row) throw new HttpError(404, `No tracked app matches ${ref.bundleId ?? ref.trackId}. Add the app in Open ASO first.`);
  return row.id;
}

function normalizeCountry(value: string | undefined | null) {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  return /^[a-z]{2}$/.test(v) ? v : null;
}

function sqlTimestamp(date: Date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function clampDate(iso: string | undefined) {
  const now = Date.now();
  if (!iso) return new Date(now);
  const t = Date.parse(iso);
  if (!Number.isFinite(t) || t > now + 5 * 60 * 1000) return new Date(now);
  return new Date(t);
}

export function keywordText(keywordId: string | null | undefined) {
  if (!keywordId) return null;
  const row = analyticsDb().prepare("SELECT keyword FROM ads_keyword_daily WHERE keyword_id = ? ORDER BY date DESC LIMIT 1").get(keywordId) as { keyword: string } | undefined;
  return row?.keyword ?? null;
}

export function applyAttribution(installId: number, record: AttributionPayload) {
  if (!record.attribution) return false;
  analyticsDb()
    .prepare(
      `UPDATE installs SET source = 'apple_ads', campaign_id = COALESCE(?, campaign_id), ad_group_id = COALESCE(?, ad_group_id),
        keyword_id = COALESCE(?, keyword_id), keyword = COALESCE(?, keyword), country = COALESCE(country, ?) WHERE id = ?`,
    )
    .run(record.campaignId ?? null, record.adGroupId ?? null, record.keywordId ?? null, keywordText(record.keywordId), normalizeCountry(record.countryOrRegion), installId);
  return true;
}

export type InstallResult = { installId: number; appId: number; source: string; attribution: "resolved" | "pending" | "none"; created: boolean };

export function recordInstall(input: InstallInput): InstallResult {
  const d = analyticsDb();
  const appId = resolveAppId(input);
  const existing = d.prepare("SELECT id FROM installs WHERE app_id = ? AND user_id = ?").get(appId, input.userId) as { id: number } | undefined;
  d.prepare(
    `INSERT INTO installs (app_id, user_id, country, city, installed_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(app_id, user_id) DO UPDATE SET country = COALESCE(excluded.country, installs.country), city = COALESCE(excluded.city, installs.city)`,
  ).run(appId, input.userId, normalizeCountry(input.country), input.city || null, sqlTimestamp(clampDate(input.installedAt)));
  const install = d.prepare("SELECT id, source FROM installs WHERE app_id = ? AND user_id = ?").get(appId, input.userId) as { id: number; source: string };
  let attribution: InstallResult["attribution"] = "none";
  if (input.attribution?.attribution) {
    applyAttribution(install.id, input.attribution);
    attribution = "resolved";
  } else if (input.adServicesToken && install.source !== "apple_ads") {
    d.prepare(
      `INSERT INTO attribution_pending (install_id, token) VALUES (?, ?)
       ON CONFLICT(install_id) DO UPDATE SET token = excluded.token, attempts = 0, status = 'pending', last_error = NULL, created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE attribution_pending.status != 'resolved'`,
    ).run(install.id, input.adServicesToken);
    attribution = "pending";
  }
  const source = (d.prepare("SELECT source FROM installs WHERE id = ?").get(install.id) as { source: string }).source;
  logIntegrationEvent("sdk", existing ? "duplicate" : "ok", "install", `${input.userId} · ${source}${attribution === "pending" ? " · AdServices pending" : ""}`);
  return { installId: install.id, appId, source, attribution, created: !existing };
}

export function recordEvent(input: EventInput) {
  const d = analyticsDb();
  const appId = resolveAppId(input);
  const at = clampDate(input.at);
  d.prepare("INSERT INTO installs (app_id, user_id, country, city, installed_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(app_id, user_id) DO NOTHING").run(
    appId,
    input.userId,
    normalizeCountry(input.country),
    input.city || null,
    sqlTimestamp(at),
  );
  d.prepare("INSERT INTO analytics_sessions (app_id, user_id, date) VALUES (?, ?, ?) ON CONFLICT(app_id, user_id, date) DO UPDATE SET count = count + 1").run(appId, input.userId, at.toISOString().slice(0, 10));
  return { appId };
}

type FetchOutcome = { kind: "ok"; record: AttributionPayload } | { kind: "invalid" } | { kind: "notfound" } | { kind: "retry"; error: string };

export async function fetchAdServicesAttribution(token: string): Promise<FetchOutcome> {
  try {
    const res = await fetch(ADSERVICES_URL, { method: "POST", headers: { "Content-Type": "text/plain" }, body: token, signal: AbortSignal.timeout(15000) });
    if (res.status === 200) {
      const parsed = attributionPayload.safeParse(await res.json());
      return parsed.success ? { kind: "ok", record: parsed.data } : { kind: "retry", error: "Unexpected AdServices payload" };
    }
    if (res.status === 400) return { kind: "invalid" };
    if (res.status === 404) return { kind: "notfound" };
    return { kind: "retry", error: `AdServices responded ${res.status}` };
  } catch (error) {
    return { kind: "retry", error: error instanceof Error ? error.message : "Network error" };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function markPending(installId: number, status: string, error: string | null, attempts: number) {
  analyticsDb()
    .prepare("UPDATE attribution_pending SET status = ?, last_error = ?, attempts = attempts + ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE install_id = ?")
    .run(status, error, attempts, installId);
}

async function attempt(installId: number, token: string, tries: number) {
  let last: FetchOutcome = { kind: "retry", error: "Not attempted" };
  let used = 0;
  for (let i = 0; i < tries; i++) {
    if (i > 0) await sleep(RETRY_DELAY_MS);
    used++;
    last = await fetchAdServicesAttribution(token);
    if (last.kind !== "notfound") break;
  }
  if (last.kind === "ok") {
    const attributed = applyAttribution(installId, last.record);
    markPending(installId, "resolved", null, used);
    logIntegrationEvent("sdk", "ok", "adservices", attributed ? `Apple Ads install · keyword ${last.record.keywordId ?? "n/a"}` : "AdServices: not attributed (organic)");
    return;
  }
  if (last.kind === "invalid") {
    markPending(installId, "invalid", "AdServices rejected the token (400)", used);
    logIntegrationEvent("sdk", "error", "adservices", "AdServices rejected the token (400)");
    return;
  }
  markPending(installId, "pending", last.kind === "notfound" ? "Attribution record not found yet (404)" : last.error, used);
}

export async function resolvePendingAttribution(installId: number) {
  const row = analyticsDb().prepare("SELECT token FROM attribution_pending WHERE install_id = ? AND status = 'pending'").get(installId) as { token: string } | undefined;
  if (row) await attempt(installId, row.token, MAX_INLINE_ATTEMPTS);
}

export async function drainPendingAttribution(limit = 10) {
  const d = analyticsDb();
  d.prepare("UPDATE attribution_pending SET status = 'expired' WHERE status = 'pending' AND (created_at < ? OR attempts >= ?)").run(new Date(Date.now() - TOKEN_TTL_MS).toISOString(), MAX_TOTAL_ATTEMPTS);
  const rows = d
    .prepare("SELECT install_id, token FROM attribution_pending WHERE status = 'pending' AND updated_at < ? ORDER BY updated_at ASC LIMIT ?")
    .all(new Date(Date.now() - 60 * 1000).toISOString(), limit) as { install_id: number; token: string }[];
  for (const row of rows) await attempt(row.install_id, row.token, 1);
}
