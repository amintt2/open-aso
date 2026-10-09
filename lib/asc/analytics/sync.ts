import { getApp } from "@/lib/aso/apps";
import { resolveAscAppId } from "@/lib/asc/apps";
import { AscError } from "@/lib/asc/client";
import { clearImpactCache } from "@/lib/impact/service";
import { cacheDelete } from "@/lib/server/cache";
import { db, parseJson } from "@/lib/server/db";
import { HttpError } from "@/lib/server/http";
import type { FixtureMode } from "./fixtures";
import { aggregateReport, FAMILY_METRICS, METRIC_COLUMNS, parseReport, type Aggregate } from "./parse";
import { analyticsCachePrefix, dataThroughFor } from "./coverage";
import { ensureReportRequests, ensureReports, READ_ROLE_MESSAGE, type StoredRequest } from "./requests";
import { addDays, isUpToDate, jitterMinutes, medianMinute, nextCheckAt, utcDay } from "./schedule";
import { demoTransport, liveTransport, type Transport } from "./transport";
import type { AccessType, ReportFamily, SyncLogEntry, SyncResult } from "./types";

export type Trigger = SyncLogEntry["trigger"];

type SyncRow = {
  demo: boolean;
  last_processing_date: string | null;
  data_through: string | null;
  fresh_day: string | null;
  check_day: string | null;
  checks_today: number;
  empty_checks_today: number;
  api_calls_today: number;
  api_calls_total: number;
  publish_minute: number | null;
  last_new_at: string | null;
  log: unknown;
};

type Instance = { id: string; processingDate: string; family: ReportFamily; request: StoredRequest };

const FAMILIES: ReportFamily[] = ["downloads", "engagement", "purchases"];
const SNAPSHOT_HISTORY_DAYS = 400;
const SNAPSHOT_BUDGET = 120;
const CATCHUP_DAYS = 7;
const LOG_SIZE = 20;

async function loadState(workspaceId: string, appId: number) {
  return db.get<SyncRow>("SELECT * FROM asc_analytics_sync WHERE workspace_id = ? AND app_id = ?", [workspaceId, appId]);
}

function dateRange(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 40; d = addDays(d, 1)) out.push(d);
  return out;
}

async function lastProcessingDate(workspaceId: string, appId: number, family: ReportFamily, accessType: AccessType) {
  const row = await db.get<{ d: string | null }>(
    "SELECT max(processing_date) AS d FROM asc_report_instances_seen WHERE workspace_id = ? AND app_id = ? AND family = ? AND access_type = ?",
    [workspaceId, appId, family, accessType],
  );
  return row?.d ?? null;
}

async function unseen(workspaceId: string, list: Instance[]) {
  if (!list.length) return list;
  const seen = await db.all<{ instance_id: string }>("SELECT instance_id FROM asc_report_instances_seen WHERE workspace_id = ? AND instance_id = ANY(?::text[])", [
    workspaceId,
    list.map((i) => i.id),
  ]);
  const ids = new Set(seen.map((s) => s.instance_id));
  return list.filter((i) => !ids.has(i.id));
}

async function listInstances(t: Transport, reportId: string, family: ReportFamily, request: StoredRequest, dates: string[] | null) {
  const filter = dates ? `&filter[processingDate]=${dates.join(",")}` : "";
  const docs = await t.getAll<{ granularity?: string; processingDate?: string }>(`/v1/analyticsReports/${reportId}/instances?filter[granularity]=DAILY${filter}&limit=200`);
  return docs
    .filter((d) => (d.attributes?.granularity ?? "DAILY") === "DAILY" && d.attributes?.processingDate)
    .map((d) => ({ id: d.id, processingDate: String(d.attributes?.processingDate).slice(0, 10), family, request }));
}

async function newOngoing(workspaceId: string, appId: number, t: Transport, request: StoredRequest, family: ReportFamily, today: string) {
  const reportId = request.reports[family];
  if (!reportId) return [];
  const last = await lastProcessingDate(workspaceId, appId, family, "ONGOING");
  const catchup = last != null && last >= addDays(today, -CATCHUP_DAYS);
  const dates = catchup ? dateRange(addDays(last, 1), today) : null;
  if (dates && !dates.length) return [];
  return unseen(workspaceId, await listInstances(t, reportId, family, request, dates));
}

async function applyAggregate(workspaceId: string, appId: number, inst: Instance, agg: Aggregate, meta: { segments: number; rows: number; backfill: boolean }) {
  const metrics = FAMILY_METRICS[inst.family];
  const cols = metrics.map((m) => METRIC_COLUMNS[m]);
  const rows = [...agg.values()];
  const dates = [...new Set(rows.map((r) => r.date))];
  await db.tx(async (q) => {
    const covered = dates.length
      ? await q.all<{ date: string; processing_date: string }>(
          "SELECT date, processing_date FROM asc_analytics_coverage WHERE workspace_id = ? AND app_id = ? AND family = ? AND date = ANY(?::date[])",
          [workspaceId, appId, inst.family, dates],
        )
      : [];
    const newer = new Set(covered.filter((c) => c.processing_date > inst.processingDate).map((c) => c.date));
    const allowed = dates.filter((d) => !newer.has(d));
    const keep = rows.filter((r) => !newer.has(r.date));
    if (allowed.length) {
      await q.run(`UPDATE asc_analytics_daily SET ${cols.map((c) => `${c} = 0`).join(", ")} WHERE workspace_id = ? AND app_id = ? AND date = ANY(?::date[])`, [workspaceId, appId, allowed]);
      const values = metrics.map((m) => keep.map((r) => (m === "proceeds" || m === "sales" ? Math.round(r[m] * 100) / 100 : m === "purchases" ? Math.round(r[m]) : Math.max(0, Math.round(r[m])))));
      const casts = metrics.map((m) => (m === "proceeds" || m === "sales" ? "float8[]" : "int[]"));
      await q.run(
        `INSERT INTO asc_analytics_daily (workspace_id, app_id, date, territory, source_type, ${cols.join(", ")})
         SELECT ?, ?, u.d, u.t, u.s, ${cols.map((_, i) => `u.c${i}`).join(", ")}
         FROM unnest(?::date[], ?::text[], ?::text[], ${casts.map((c) => `?::${c}`).join(", ")}) AS u(d, t, s, ${cols.map((_, i) => `c${i}`).join(", ")})
         ON CONFLICT (workspace_id, app_id, date, territory, source_type) DO UPDATE SET ${cols.map((c) => `${c} = EXCLUDED.${c}`).join(", ")}`,
        [workspaceId, appId, keep.map((r) => r.date), keep.map((r) => r.territory), keep.map((r) => r.source), ...values],
      );
      await q.run(
        `INSERT INTO asc_analytics_coverage (workspace_id, app_id, family, date, processing_date) SELECT ?, ?, ?, d, ?::date FROM unnest(?::date[]) AS d
         ON CONFLICT (workspace_id, app_id, family, date) DO UPDATE SET processing_date = EXCLUDED.processing_date`,
        [workspaceId, appId, inst.family, inst.processingDate, allowed],
      );
      await q.run(
        `DELETE FROM asc_analytics_daily WHERE workspace_id = ? AND app_id = ? AND date = ANY(?::date[]) AND impressions = 0 AND impressions_unique = 0 AND page_views = 0
           AND page_views_unique = 0 AND first_downloads = 0 AND redownloads = 0 AND updates = 0 AND purchases = 0 AND proceeds_usd = 0 AND sales_usd = 0`,
        [workspaceId, appId, allowed],
      );
    }
    await q.run(
      `INSERT INTO asc_report_instances_seen (workspace_id, instance_id, app_id, request_id, family, access_type, processing_date, backfill, segments, rows)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (workspace_id, instance_id) DO NOTHING`,
      [workspaceId, inst.id, appId, inst.request.requestId, inst.family, inst.request.accessType, inst.processingDate, meta.backfill, meta.segments, meta.rows],
    );
  });
}

async function processInstance(workspaceId: string, appId: number, t: Transport, inst: Instance, backfill: boolean) {
  const segments = await t.getAll<{ url?: string; checksum?: string; sizeInBytes?: number }>(
    `/v1/analyticsReportInstances/${inst.id}/segments?fields[analyticsReportSegments]=url,checksum,sizeInBytes&limit=200`,
  );
  const agg: Aggregate = new Map();
  let rows = 0;
  for (const s of segments) {
    if (!s.attributes?.url) continue;
    const text = await t.segment(s.attributes.url, { checksum: s.attributes.checksum, sizeInBytes: s.attributes.sizeInBytes });
    rows += aggregateReport(inst.family, parseReport(text), agg).rows;
  }
  await applyAggregate(workspaceId, appId, inst, agg, { segments: segments.length, rows, backfill });
  return rows;
}

async function processAll(workspaceId: string, appId: number, t: Transport, list: Instance[], backfill: (i: Instance) => boolean) {
  let rows = 0;
  const sorted = [...list].sort((a, b) => (a.processingDate < b.processingDate ? -1 : a.processingDate > b.processingDate ? 1 : FAMILIES.indexOf(a.family) - FAMILIES.indexOf(b.family)));
  for (const inst of sorted) rows += await processInstance(workspaceId, appId, t, inst, backfill(inst));
  return rows;
}

async function syncSnapshot(workspaceId: string, appId: number, t: Transport, request: StoredRequest, today: string) {
  const reports = await ensureReports(workspaceId, request, t);
  if (!reports) return { instances: 0, rows: 0, done: false };
  const cutoff = addDays(today, -SNAPSHOT_HISTORY_DAYS);
  let pending: Instance[] = [];
  for (const family of FAMILIES) {
    const reportId = reports[family];
    if (!reportId) continue;
    pending.push(...(await unseen(workspaceId, (await listInstances(t, reportId, family, request, null)).filter((i) => i.processingDate >= cutoff))));
  }
  pending = pending.sort((a, b) => (a.processingDate < b.processingDate ? -1 : 1));
  const batch = pending.slice(0, SNAPSHOT_BUDGET);
  const rows = await processAll(workspaceId, appId, t, batch, () => true);
  const seenBefore = await db.get<{ n: number }>(
    "SELECT count(*) AS n FROM asc_report_instances_seen WHERE workspace_id = ? AND request_id = ?",
    [workspaceId, request.requestId],
  );
  const done = pending.length <= SNAPSHOT_BUDGET && (batch.length > 0 || (seenBefore?.n ?? 0) > 0);
  await db.run(`UPDATE asc_report_requests SET last_synced_at = now(), last_error = NULL${done ? ", completed_at = now()" : ""} WHERE workspace_id = ? AND request_id = ?`, [
    workspaceId,
    request.requestId,
  ]);
  return { instances: batch.length, rows, done };
}

async function checkStopped(workspaceId: string, t: Transport, request: StoredRequest) {
  try {
    const doc = (await t.get<{ stoppedDueToInactivity?: boolean }>(`/v1/analyticsReportRequests/${request.requestId}`)) as unknown as { data?: { attributes?: { stoppedDueToInactivity?: boolean } } };
    if (doc.data?.attributes?.stoppedDueToInactivity) {
      await db.run("UPDATE asc_report_requests SET stopped = true, last_error = ? WHERE workspace_id = ? AND request_id = ?", [
        "Apple stopped this request due to inactivity; a new one will be created",
        workspaceId,
        request.requestId,
      ]);
      return true;
    }
  } catch (error) {
    if (error instanceof AscError && error.appleStatus === 404) {
      await db.run("UPDATE asc_report_requests SET stopped = true WHERE workspace_id = ? AND request_id = ?", [workspaceId, request.requestId]);
      return true;
    }
  }
  return false;
}

async function learnedPublishMinute(workspaceId: string, appId: number) {
  const rows = await db.all<{ m: number }>(
    `SELECT (extract(hour FROM first_seen_at AT TIME ZONE 'UTC') * 60 + extract(minute FROM first_seen_at AT TIME ZONE 'UTC'))::int AS m
     FROM asc_report_instances_seen WHERE workspace_id = ? AND app_id = ? AND access_type = 'ONGOING' AND backfill = false AND family IN ('downloads', 'engagement')
     ORDER BY first_seen_at DESC LIMIT 14`,
    [workspaceId, appId],
  );
  return medianMinute(rows.map((r) => r.m));
}

type RunOutcome = { outcome: SyncLogEntry["outcome"]; instances: number; rows: number; freshOngoing: boolean; message: string | null };

async function run(workspaceId: string, appId: number, ascAppId: string, t: Transport, state: SyncRow | undefined, now: number): Promise<RunOutcome> {
  const today = utcDay(now);
  let requests = await ensureReportRequests(workspaceId, appId, ascAppId, t);
  let ongoing = requests.find((r) => r.accessType === "ONGOING" && !r.stopped);
  if (!ongoing) throw new HttpError(409, "No active analytics report request for this app");
  let instances = 0;
  let rows = 0;
  let freshOngoing = false;
  let waiting = false;
  const reports = await ensureReports(workspaceId, ongoing, t);
  if (!reports) waiting = true;
  else {
    const primary: ReportFamily = reports.downloads ? "downloads" : "engagement";
    const firstRun = !state?.last_processing_date;
    let found = await newOngoing(workspaceId, appId, t, ongoing, primary, today);
    if (!found.length && !t.demo && (state?.empty_checks_today ?? 0) === 0 && state?.data_through && state.data_through < addDays(today, -4) && (await checkStopped(workspaceId, t, ongoing))) {
      requests = await ensureReportRequests(workspaceId, appId, ascAppId, t);
      ongoing = requests.find((r) => r.accessType === "ONGOING" && !r.stopped);
      if (!ongoing) throw new HttpError(409, "No active analytics report request for this app");
      found = [];
    }
    if (found.length) {
      const others = FAMILIES.filter((f) => f !== primary && reports[f]);
      for (const f of others) found.push(...(await newOngoing(workspaceId, appId, t, ongoing, f, today)));
      const yesterday = addDays(today, -1);
      rows += await processAll(workspaceId, appId, t, found, (i) => firstRun || i.processingDate < yesterday);
      instances += found.length;
      freshOngoing = !firstRun && found.some((i) => i.family === primary && i.processingDate >= yesterday);
    }
    await db.run("UPDATE asc_report_requests SET last_synced_at = now(), last_error = NULL WHERE workspace_id = ? AND request_id = ?", [workspaceId, ongoing.requestId]);
  }
  const snapshot = requests.find((r) => r.accessType === "ONE_TIME_SNAPSHOT" && !r.stopped && !r.completedAt);
  if (snapshot) {
    const s = await syncSnapshot(workspaceId, appId, t, snapshot, today);
    instances += s.instances;
    rows += s.rows;
  }
  const outcome: RunOutcome["outcome"] = instances > 0 ? "new-data" : waiting ? "waiting" : "no-new-data";
  return { outcome, instances, rows, freshOngoing, message: waiting ? "Report requested. Apple usually needs 24–48 hours to generate the first report." : null };
}

async function persist(
  workspaceId: string,
  appId: number,
  state: SyncRow | undefined,
  input: { now: number; demo: boolean; trigger: Trigger; calls: number; downloads: number; result: RunOutcome | null; error: string | null; checked: boolean },
) {
  const today = utcDay(input.now);
  const sameDay = state?.check_day === today;
  const checksToday = (sameDay ? state.checks_today : 0) + (input.checked ? 1 : 0);
  const emptyToday = (sameDay ? state.empty_checks_today : 0) + (input.checked && input.result?.outcome !== "new-data" ? 1 : 0);
  const callsToday = (sameDay ? state.api_calls_today : 0) + input.calls;
  const dataThrough = await dataThroughFor(workspaceId, appId);
  const lastPd = (await lastProcessingDate(workspaceId, appId, "downloads", "ONGOING")) ?? (await lastProcessingDate(workspaceId, appId, "engagement", "ONGOING"));
  const freshDay = input.result?.freshOngoing ? today : (state?.fresh_day ?? null);
  const publishMinute = (await learnedPublishMinute(workspaceId, appId)) ?? state?.publish_minute ?? null;
  const upToDate = isUpToDate({ dataThrough, freshDay }, input.now);
  const roleError = !!input.error?.startsWith("This API key's role");
  const next = roleError
    ? nextCheckAt({ now: input.now, upToDate: true, emptyChecksToday: emptyToday, publishMinute, jitter: jitterMinutes(appId) })
    : input.result?.outcome === "waiting" || input.error
    ? Math.max(nextCheckAt({ now: input.now, upToDate: false, emptyChecksToday: emptyToday, publishMinute, jitter: jitterMinutes(appId) }), input.now + 60 * 60000)
    : nextCheckAt({ now: input.now, upToDate, emptyChecksToday: emptyToday, publishMinute, jitter: jitterMinutes(appId) });
  const entry: SyncLogEntry = {
    at: new Date(input.now).toISOString(),
    trigger: input.trigger,
    outcome: input.error ? "error" : (input.result?.outcome ?? "up-to-date"),
    calls: input.calls,
    downloads: input.downloads,
    instances: input.result?.instances ?? 0,
    rows: input.result?.rows ?? 0,
    ...(input.error ? { message: input.error } : input.result?.message ? { message: input.result.message } : {}),
  };
  const log = [entry, ...parseJson<SyncLogEntry[]>(state?.log, [])].slice(0, LOG_SIZE);
  await db.run(
    `INSERT INTO asc_analytics_sync (workspace_id, app_id, demo, last_processing_date, data_through, fresh_day, last_check_at, next_check_at, check_day, checks_today, empty_checks_today,
       api_calls_today, api_calls_total, publish_minute, last_new_at, manual_at, last_error, log, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, CASE WHEN ? THEN to_timestamp(? / 1000.0) ELSE NULL END, to_timestamp(? / 1000.0), ?, ?, ?, ?, ?, ?, CASE WHEN ? THEN now() ELSE NULL END,
       CASE WHEN ? THEN now() ELSE NULL END, ?, ?::jsonb, now())
     ON CONFLICT (workspace_id, app_id) DO UPDATE SET demo = EXCLUDED.demo, last_processing_date = EXCLUDED.last_processing_date, data_through = EXCLUDED.data_through,
       fresh_day = EXCLUDED.fresh_day, last_check_at = COALESCE(EXCLUDED.last_check_at, asc_analytics_sync.last_check_at), next_check_at = EXCLUDED.next_check_at,
       check_day = EXCLUDED.check_day, checks_today = EXCLUDED.checks_today, empty_checks_today = EXCLUDED.empty_checks_today, api_calls_today = EXCLUDED.api_calls_today,
       api_calls_total = asc_analytics_sync.api_calls_total + ?, publish_minute = EXCLUDED.publish_minute,
       last_new_at = COALESCE(EXCLUDED.last_new_at, asc_analytics_sync.last_new_at), manual_at = COALESCE(EXCLUDED.manual_at, asc_analytics_sync.manual_at),
       last_error = EXCLUDED.last_error, log = EXCLUDED.log, updated_at = now()`,
    [
      workspaceId,
      appId,
      input.demo,
      lastPd,
      dataThrough,
      freshDay,
      input.checked,
      input.now,
      next,
      today,
      checksToday,
      emptyToday,
      callsToday,
      input.calls,
      publishMinute,
      (input.result?.instances ?? 0) > 0,
      input.trigger !== "scheduled",
      input.error,
      JSON.stringify(log),
      input.calls,
    ],
  );
  return { next: new Date(next).toISOString(), dataThrough };
}

function message(error: unknown) {
  if (error instanceof AscError && error.appleStatus === 403) return READ_ROLE_MESSAGE;
  return error instanceof Error ? error.message : String(error);
}

export type SyncOptions = { trigger?: Trigger; fixtures?: FixtureMode | null; now?: number };

export async function syncAnalytics(workspaceId: string, appId: number, opts: SyncOptions = {}): Promise<SyncResult> {
  const app = await getApp(workspaceId, appId);
  const now = opts.now ?? Date.now();
  const trigger = opts.trigger ?? "scheduled";
  const demo = !!opts.fixtures;
  const state = await loadState(workspaceId, appId);
  const sameMode = !!state && state.demo === demo;
  if (trigger !== "forced" && sameMode && isUpToDate({ dataThrough: state.data_through, freshDay: state.fresh_day }, now)) {
    const saved = await persist(workspaceId, appId, state, { now, demo, trigger, calls: 0, downloads: 0, result: null, error: null, checked: false });
    return { outcome: "up-to-date", calls: 0, instances: 0, rows: 0, dataThrough: saved.dataThrough, nextCheckAt: saved.next, message: "Already have yesterday's numbers from Apple." };
  }
  const t = demo ? demoTransport({ ascAppId: app.ascAppId ?? String(app.trackId), name: app.name, seed: app.trackId }, opts.fixtures ?? "data", now) : liveTransport(workspaceId);
  let result: RunOutcome | null = null;
  let error: string | null = null;
  let failure: unknown = null;
  try {
    const ascAppId = demo ? (app.ascAppId ?? String(app.trackId)) : await resolveAscAppId(workspaceId, appId);
    result = await run(workspaceId, appId, ascAppId, t, sameMode ? state : undefined, now);
  } catch (e) {
    failure = e;
    error = message(e);
    if (!(e instanceof HttpError) || e.status !== 412)
      await db.run("UPDATE asc_report_requests SET last_error = ? WHERE workspace_id = ? AND app_id = ? AND NOT stopped", [error, workspaceId, appId]).catch(() => undefined);
    if (trigger === "scheduled") console.error(`[open-aso] store analytics sync failed for app ${appId}:`, error);
  }
  const saved = await persist(workspaceId, appId, sameMode ? state : undefined, { now, demo, trigger, calls: t.calls, downloads: t.downloads, result, error, checked: true });
  if (result && result.instances > 0) {
    await cacheDelete(analyticsCachePrefix(workspaceId));
    await clearImpactCache(workspaceId).catch(() => undefined);
  }
  if (error && trigger !== "scheduled") throw new HttpError(failure instanceof HttpError ? failure.status : 502, error);
  return {
    outcome: result?.outcome ?? "error",
    calls: t.calls,
    instances: result?.instances ?? 0,
    rows: result?.rows ?? 0,
    dataThrough: saved.dataThrough,
    nextCheckAt: saved.next,
    message: error ?? result?.message ?? null,
  };
}
