import { AscError } from "@/lib/asc/client";
import { db, parseJson, type Queryable } from "@/lib/server/db";
import { HttpError } from "@/lib/server/http";
import type { Transport } from "./transport";
import type { AccessType, ReportFamily } from "./types";

export const ROLE_MESSAGE =
  "This API key's role can't create analytics report requests. Apple only lets keys with the Admin role request App Analytics reports: use an Admin key (once the reports exist, a Sales and Reports or Finance key can download them), or ask an Admin to request them.";

export const READ_ROLE_MESSAGE =
  "This API key's role can't read analytics reports. Use a key with Admin, Sales and Reports or Finance access in App Store Connect → Users and Access → Integrations.";

export type StoredRequest = {
  requestId: string;
  accessType: AccessType;
  ascAppId: string;
  demo: boolean;
  reports: Partial<Record<ReportFamily, string>>;
  stopped: boolean;
  createdAt: string;
  lastSyncedAt: string | null;
  completedAt: string | null;
  lastError: string | null;
};

type Row = {
  request_id: string;
  access_type: AccessType;
  asc_app_id: string;
  demo: boolean;
  reports: unknown;
  stopped: boolean;
  created_at: string;
  last_synced_at: string | null;
  completed_at: string | null;
  last_error: string | null;
};

const ACCESS_TYPES: AccessType[] = ["ONGOING", "ONE_TIME_SNAPSHOT"];

function toRequest(r: Row): StoredRequest {
  return {
    requestId: r.request_id,
    accessType: r.access_type,
    ascAppId: r.asc_app_id,
    demo: r.demo,
    reports: parseJson(r.reports, {}),
    stopped: r.stopped,
    createdAt: r.created_at,
    lastSyncedAt: r.last_synced_at,
    completedAt: r.completed_at,
    lastError: r.last_error,
  };
}

export async function loadRequests(workspaceId: string, appId: number, q: Queryable = db) {
  const rows = await q.all<Row>("SELECT * FROM asc_report_requests WHERE workspace_id = ? AND app_id = ? ORDER BY created_at ASC", [workspaceId, appId]);
  return rows.map(toRequest);
}

export async function resetAppAnalytics(workspaceId: string, appId: number) {
  await db.tx(async (t) => {
    for (const table of ["asc_report_requests", "asc_report_instances_seen", "asc_analytics_daily", "asc_analytics_coverage", "asc_analytics_sync"])
      await t.run(`DELETE FROM ${table} WHERE workspace_id = ? AND app_id = ?`, [workspaceId, appId]);
  });
}

async function insertRequest(workspaceId: string, appId: number, ascAppId: string, demo: boolean, requestId: string, accessType: AccessType, extra: { stopped?: boolean; completed?: boolean; error?: string | null } = {}) {
  await db.run(
    `INSERT INTO asc_report_requests (workspace_id, app_id, asc_app_id, request_id, access_type, demo, stopped, completed_at, last_error)
     VALUES (?, ?, ?, ?, ?, ?, ?, CASE WHEN ? THEN now() ELSE NULL END, ?)
     ON CONFLICT (workspace_id, request_id) DO UPDATE SET app_id = EXCLUDED.app_id, stopped = EXCLUDED.stopped, last_error = EXCLUDED.last_error`,
    [workspaceId, appId, ascAppId, requestId, accessType, demo, extra.stopped ?? false, extra.completed ?? false, extra.error ?? null],
  );
}

function describe(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function ensureReportRequests(workspaceId: string, appId: number, ascAppId: string, t: Transport): Promise<StoredRequest[]> {
  let rows = await loadRequests(workspaceId, appId);
  if (rows.some((r) => r.ascAppId !== ascAppId || r.demo !== t.demo)) {
    await resetAppAnalytics(workspaceId, appId);
    rows = [];
  }
  const need = ACCESS_TYPES.filter((a) => (a === "ONGOING" ? !rows.some((r) => r.accessType === a && !r.stopped) : !rows.some((r) => r.accessType === a)));
  if (!need.length) return rows;
  let existing: { id: string; accessType?: string; stopped?: boolean }[];
  try {
    const docs = await t.getAll<{ accessType?: string; stoppedDueToInactivity?: boolean }>(
      `/v1/apps/${ascAppId}/analyticsReportRequests?fields[analyticsReportRequests]=accessType,stoppedDueToInactivity&limit=200`,
    );
    existing = docs.map((d) => ({ id: d.id, accessType: d.attributes?.accessType, stopped: !!d.attributes?.stoppedDueToInactivity }));
  } catch (error) {
    if (error instanceof AscError && error.appleStatus === 403) throw new HttpError(403, READ_ROLE_MESSAGE);
    throw error;
  }
  for (const accessType of need) {
    const found = existing.find((e) => e.accessType === accessType && !e.stopped && !rows.some((r) => r.requestId === e.id));
    if (found) {
      await insertRequest(workspaceId, appId, ascAppId, t.demo, found.id, accessType);
      continue;
    }
    try {
      const created = await t.post("/v1/analyticsReportRequests", {
        data: { type: "analyticsReportRequests", attributes: { accessType }, relationships: { app: { data: { type: "apps", id: ascAppId } } } },
      });
      await insertRequest(workspaceId, appId, ascAppId, t.demo, created.data.id, accessType);
    } catch (error) {
      const forbidden = error instanceof AscError && error.appleStatus === 403;
      if (accessType === "ONGOING") throw forbidden ? new HttpError(403, ROLE_MESSAGE) : error;
      await insertRequest(workspaceId, appId, ascAppId, t.demo, `unavailable:${ascAppId}:snapshot`, accessType, {
        stopped: true,
        completed: true,
        error: forbidden ? ROLE_MESSAGE : `Historical snapshot not available: ${describe(error)}`,
      });
    }
  }
  return loadRequests(workspaceId, appId);
}

const CATEGORIES = "APP_STORE_ENGAGEMENT,COMMERCE";

const MATCHERS: { family: ReportFamily; test: (name: string) => boolean }[] = [
  { family: "engagement", test: (n) => /discovery and engagement/i.test(n) },
  { family: "downloads", test: (n) => /\bdownloads?\b/i.test(n) && !/pre-?order/i.test(n) },
  { family: "purchases", test: (n) => /\bpurchases?\b/i.test(n) && !/pre-?order/i.test(n) },
];

export function pickReports(list: { id: string; name: string }[]) {
  const out: Partial<Record<ReportFamily, string>> = {};
  for (const m of MATCHERS) {
    const candidates = list.filter((r) => m.test(r.name));
    const chosen = candidates.find((r) => /standard/i.test(r.name)) ?? candidates.find((r) => !/detailed/i.test(r.name)) ?? candidates[0];
    if (chosen) out[m.family] = chosen.id;
  }
  return out;
}

export async function ensureReports(workspaceId: string, request: StoredRequest, t: Transport) {
  if (request.reports.downloads || request.reports.engagement) return request.reports;
  let list: { id: string; name: string }[];
  try {
    const docs = await t.getAll<{ name?: string; category?: string }>(
      `/v1/analyticsReportRequests/${request.requestId}/reports?filter[category]=${CATEGORIES}&fields[analyticsReports]=name,category&limit=200`,
    );
    list = docs.map((d) => ({ id: d.id, name: d.attributes?.name ?? "" }));
  } catch (error) {
    if (error instanceof AscError && error.appleStatus === 403) throw new HttpError(403, READ_ROLE_MESSAGE);
    if (error instanceof AscError && error.appleStatus === 404) {
      await db.run("UPDATE asc_report_requests SET stopped = true, last_error = ? WHERE workspace_id = ? AND request_id = ?", ["The report request no longer exists", workspaceId, request.requestId]);
      return null;
    }
    throw error;
  }
  const reports = pickReports(list);
  if (!reports.downloads && !reports.engagement) return null;
  await db.run("UPDATE asc_report_requests SET reports = ?::jsonb WHERE workspace_id = ? AND request_id = ?", [JSON.stringify(reports), workspaceId, request.requestId]);
  request.reports = reports;
  return reports;
}
