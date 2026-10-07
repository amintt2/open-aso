import { db } from "@/lib/server/db";
import { hasOwnWorker, hasSharedWorkerFor } from "./presence";
import { SHARED_PER_HOUR, sharedNetworkEnabled } from "./sharing";
import { isWorkerUrl, taskKind, validateBody } from "./urls";

export const LEASE_SECONDS = 30;
export const MAX_ATTEMPTS = 3;
export const MAX_LEASE = 4;

const POLL_MS = 300;
const PRESENCE_CHECK_MS = 1_000;
const MAINTENANCE_MS = 60_000;

export type TaskResult = { status: number; body: string };
type Finished = { status: "done" | "failed"; httpStatus: number | null; body: string | null; error: string | null };
type Waiter = (result: Finished) => void;
type QueueState = { waiters: Map<number, Set<Waiter>>; timer: ReturnType<typeof setInterval> | null; polling: boolean; maintainedAt: number };
type GlobalWithQueue = typeof globalThis & { __openAsoFetchQueue?: QueueState };

function state(): QueueState {
  const g = globalThis as GlobalWithQueue;
  g.__openAsoFetchQueue ??= { waiters: new Map(), timer: null, polling: false, maintainedAt: 0 };
  return g.__openAsoFetchQueue;
}

function settle(id: number, result: Finished) {
  const s = state();
  const set = s.waiters.get(id);
  if (!set) return;
  s.waiters.delete(id);
  for (const w of set) w(result);
}

async function poll() {
  const s = state();
  if (s.polling) return;
  if (!s.waiters.size) {
    if (s.timer) clearInterval(s.timer);
    s.timer = null;
    return;
  }
  s.polling = true;
  try {
    const rows = await db.all<{ id: number; status: "done" | "failed"; http_status: number | null; body: string | null; error: string | null }>(
      "SELECT id, status, http_status, body, error FROM fetch_tasks WHERE id = ANY(?::bigint[]) AND status IN ('done', 'failed')",
      [[...s.waiters.keys()]],
    );
    for (const r of rows) settle(r.id, { status: r.status, httpStatus: r.http_status, body: r.body, error: r.error });
  } catch (error) {
    console.error("[open-aso] fetch task poll failed", error);
  } finally {
    s.polling = false;
  }
}

function addWaiter(id: number, waiter: Waiter) {
  const s = state();
  const set = s.waiters.get(id) ?? new Set();
  set.add(waiter);
  s.waiters.set(id, set);
  s.timer ??= setInterval(() => void poll(), POLL_MS);
  return () => {
    set.delete(waiter);
    if (!set.size) s.waiters.delete(id);
  };
}

export async function enqueueTask(workspaceId: string, url: string, shared: boolean): Promise<number> {
  if (!isWorkerUrl(url)) throw new Error("URL not allowed for browser workers");
  const row = await db.get<{ id: number }>(
    `INSERT INTO fetch_tasks (workspace_id, url, shared) VALUES (?, ?, ?)
     ON CONFLICT (workspace_id, url) WHERE status IN ('pending', 'leased')
     DO UPDATE SET shared = fetch_tasks.shared OR excluded.shared
     RETURNING id`,
    [workspaceId, url, shared],
  );
  if (!row) throw new Error("Could not queue the request");
  return row.id;
}

async function expirePending(id: number, workspaceId: string, reason: string) {
  await db
    .run("UPDATE fetch_tasks SET status = 'failed', error = ?, finished_at = now() WHERE id = ? AND workspace_id = ? AND status = 'pending'", [reason, id, workspaceId])
    .catch(() => undefined);
}

export async function requestViaWorker(
  workspaceId: string,
  url: string,
  opts: { timeoutMs?: number; shared?: boolean } = {},
): Promise<TaskResult | null> {
  const timeoutMs = opts.timeoutMs ?? 25_000;
  const shared = !!opts.shared;
  const id = await enqueueTask(workspaceId, url, shared);
  const result = await new Promise<Finished | null>((resolve) => {
    const startedAt = Date.now();
    let done = false;
    const finish = (r: Finished | null) => {
      if (done) return;
      done = true;
      clearInterval(watch);
      clearTimeout(timer);
      remove();
      resolve(r);
    };
    const remove = addWaiter(id, finish);
    const timer = setTimeout(() => {
      void expirePending(id, workspaceId, "No browser picked this up in time");
      finish(null);
    }, timeoutMs);
    const watch = setInterval(() => {
      if (Date.now() - startedAt < 3_000) return;
      if (hasOwnWorker(workspaceId) || (shared && hasSharedWorkerFor(workspaceId))) return;
      void expirePending(id, workspaceId, "No browser is connected");
      finish(null);
    }, PRESENCE_CHECK_MS);
  });
  if (!result || result.status !== "done" || result.body == null) return null;
  await db.run("UPDATE fetch_tasks SET body = NULL WHERE id = ? AND workspace_id = ?", [id, workspaceId]).catch(() => undefined);
  return { status: result.httpStatus ?? 0, body: result.body };
}

export async function maintainQueue(force = false) {
  const s = state();
  if (!force && Date.now() - s.maintainedAt < MAINTENANCE_MS) return;
  s.maintainedAt = Date.now();
  await db.run(
    `UPDATE fetch_tasks SET status = 'failed', error = 'Expired before a browser picked it up', finished_at = now()
     WHERE status = 'pending' AND created_at < now() - interval '2 minutes'`,
  );
  await db.run("UPDATE fetch_tasks SET body = NULL WHERE status = 'done' AND body IS NOT NULL AND finished_at < now() - interval '2 minutes'");
  await db.run("DELETE FROM fetch_tasks WHERE status IN ('done', 'failed') AND finished_at < now() - interval '1 hour'");
}

async function requeueExpiredLeases() {
  await db.run(
    `UPDATE fetch_tasks SET
       status = CASE WHEN attempts >= ? THEN 'failed' ELSE 'pending' END,
       error = CASE WHEN attempts >= ? THEN 'Browser workers did not answer' ELSE error END,
       finished_at = CASE WHEN attempts >= ? THEN now() ELSE NULL END,
       leased_by = NULL, leased_workspace_id = NULL, leased_until = NULL
     WHERE status = 'leased' AND leased_until < now()`,
    [MAX_ATTEMPTS, MAX_ATTEMPTS, MAX_ATTEMPTS],
  );
}

export function leaserId(userId: string, sessionId: string) {
  return `${userId}:${sessionId}`;
}

export async function sharedLeasesLastHour(leasedBy: string) {
  const row = await db.get<{ n: number }>(
    `SELECT count(*)::int AS n FROM fetch_tasks
     WHERE leased_by = ? AND shared AND leased_workspace_id IS DISTINCT FROM workspace_id
       AND coalesce(finished_at, now()) > now() - interval '1 hour'`,
    [leasedBy],
  );
  return row?.n ?? 0;
}

type Leased = { id: number; url: string; workspace_id: string };

export async function leaseTasks(input: {
  workspaceId: string;
  userId: string;
  sessionId: string;
  max: number;
  includeShared: boolean;
}): Promise<{ id: number; url: string; shared: boolean }[]> {
  await maintainQueue();
  await requeueExpiredLeases();
  const leasedBy = leaserId(input.userId, input.sessionId);
  const max = Math.max(0, Math.min(MAX_LEASE, input.max));
  const open = await db.get<{ n: number }>("SELECT count(*)::int AS n FROM fetch_tasks WHERE status = 'leased' AND leased_by = ?", [leasedBy]);
  let room = max - (open?.n ?? 0);
  if (room <= 0) return [];
  const leased: Leased[] = await db.all<Leased>(
    `WITH picked AS (
       SELECT id FROM fetch_tasks
       WHERE workspace_id = ? AND status = 'pending' AND attempts < ?
       ORDER BY created_at ASC LIMIT ? FOR UPDATE SKIP LOCKED
     )
     UPDATE fetch_tasks t SET status = 'leased', leased_by = ?, leased_workspace_id = ?,
       leased_until = now() + make_interval(secs => ?), attempts = t.attempts + 1
     FROM picked WHERE t.id = picked.id
     RETURNING t.id, t.url, t.workspace_id`,
    [input.workspaceId, MAX_ATTEMPTS, room, leasedBy, input.workspaceId, LEASE_SECONDS],
  );
  room -= leased.length;
  if (input.includeShared && sharedNetworkEnabled() && room > 0) {
    const budget = SHARED_PER_HOUR - (await sharedLeasesLastHour(leasedBy));
    const take = Math.min(room, budget);
    if (take > 0) {
      leased.push(
        ...(await db.all<Leased>(
          `WITH picked AS (
             SELECT t.id FROM fetch_tasks t
             WHERE t.status = 'pending' AND t.shared AND t.attempts < ? AND t.workspace_id <> ?
               AND EXISTS (SELECT 1 FROM workspace_settings s WHERE s.workspace_id = t.workspace_id AND s.key = 'worker.shared' AND s.value = 'true')
               AND EXISTS (SELECT 1 FROM workspace_settings s WHERE s.workspace_id = ? AND s.key = 'worker.shared' AND s.value = 'true')
             ORDER BY t.created_at ASC LIMIT ? FOR UPDATE SKIP LOCKED
           )
           UPDATE fetch_tasks t SET status = 'leased', leased_by = ?, leased_workspace_id = ?,
             leased_until = now() + make_interval(secs => ?), attempts = t.attempts + 1
           FROM picked WHERE t.id = picked.id
           RETURNING t.id, t.url, t.workspace_id`,
          [MAX_ATTEMPTS, input.workspaceId, input.workspaceId, take, leasedBy, input.workspaceId, LEASE_SECONDS],
        )),
      );
    }
  }
  const out: { id: number; url: string; shared: boolean }[] = [];
  for (const t of leased) {
    if (!isWorkerUrl(t.url)) {
      await db.run("UPDATE fetch_tasks SET status = 'failed', error = 'URL not allowed', finished_at = now() WHERE id = ?", [t.id]);
      continue;
    }
    out.push({ id: t.id, url: t.url, shared: t.workspace_id !== input.workspaceId });
  }
  return out;
}

async function bumpDaily(workspaceId: string, field: "completed" | "failed" | "served_shared", error?: string) {
  await db.run(
    `INSERT INTO fetch_worker_daily (workspace_id, day, ${field}, last_error, last_error_at)
     VALUES (?, current_date, 1, ?, ${error ? "now()" : "NULL"})
     ON CONFLICT (workspace_id, day) DO UPDATE SET ${field} = fetch_worker_daily.${field} + 1,
       last_error = coalesce(excluded.last_error, fetch_worker_daily.last_error),
       last_error_at = coalesce(excluded.last_error_at, fetch_worker_daily.last_error_at)`,
    [workspaceId, error ?? null],
  );
}

export type CompleteOutcome = "done" | "failed" | "unknown";

export async function completeTask(input: {
  workspaceId: string;
  userId: string;
  sessionId: string;
  id: number;
  status: number;
  body?: string;
  error?: string;
}): Promise<CompleteOutcome> {
  const leasedBy = leaserId(input.userId, input.sessionId);
  const task = await db.get<{ id: number; workspace_id: string; url: string }>(
    "SELECT id, workspace_id, url FROM fetch_tasks WHERE id = ? AND status = 'leased' AND leased_by = ? AND leased_workspace_id = ?",
    [input.id, leasedBy, input.workspaceId],
  );
  if (!task || !taskKind(task.url)) return "unknown";
  let problem: string | null = null;
  if (input.status !== 200) problem = input.error?.slice(0, 200) || `App Store responded ${input.status || "with a network error"}`;
  else if (input.body == null) problem = "Empty response";
  else problem = validateBody(task.url, input.body);
  const ok = problem === null;
  const changed = await db.run(
    `UPDATE fetch_tasks SET status = ?, http_status = ?, body = ?, error = ?, finished_at = now(), leased_until = NULL
     WHERE id = ? AND status = 'leased' AND leased_by = ?`,
    [ok ? "done" : "failed", input.status || null, ok ? input.body : null, problem, task.id, leasedBy],
  );
  if (!changed) return "unknown";
  const outcome: Finished = ok
    ? { status: "done", httpStatus: input.status, body: input.body ?? null, error: null }
    : { status: "failed", httpStatus: input.status || null, body: null, error: problem };
  settle(task.id, outcome);
  if (ok) {
    await bumpDaily(task.workspace_id, "completed");
    if (task.workspace_id !== input.workspaceId) await bumpDaily(input.workspaceId, "served_shared");
  } else {
    await bumpDaily(input.workspaceId, "failed", problem ?? undefined);
  }
  return ok ? "done" : "failed";
}

export async function workspaceQueueStats(workspaceId: string) {
  const [hour, today, open] = await Promise.all([
    db.get<{ done: number; failed: number }>(
      `SELECT count(*) FILTER (WHERE status = 'done')::int AS done, count(*) FILTER (WHERE status = 'failed')::int AS failed
       FROM fetch_tasks WHERE workspace_id = ? AND finished_at > now() - interval '1 hour'`,
      [workspaceId],
    ),
    db.get<{ completed: number; failed: number; served_shared: number; last_error: string | null; last_error_at: string | null }>(
      "SELECT completed, failed, served_shared, last_error, last_error_at FROM fetch_worker_daily WHERE workspace_id = ? AND day = current_date",
      [workspaceId],
    ),
    db.get<{ n: number }>("SELECT count(*)::int AS n FROM fetch_tasks WHERE workspace_id = ? AND status IN ('pending', 'leased')", [workspaceId]),
  ]);
  const lastError = today?.last_error
    ? { message: today.last_error, at: today.last_error_at }
    : ((await db.get<{ message: string; at: string }>(
        "SELECT last_error AS message, last_error_at AS at FROM fetch_worker_daily WHERE workspace_id = ? AND last_error IS NOT NULL ORDER BY day DESC LIMIT 1",
        [workspaceId],
      )) ?? null);
  return {
    doneHour: hour?.done ?? 0,
    failedHour: hour?.failed ?? 0,
    doneToday: today?.completed ?? 0,
    failedToday: today?.failed ?? 0,
    servedSharedToday: today?.served_shared ?? 0,
    open: open?.n ?? 0,
    lastError,
  };
}

export async function networkQueueStats() {
  const row = await db.get<{ pending: number; leased: number; done_hour: number; failed_hour: number; shared_done_hour: number }>(
    `SELECT count(*) FILTER (WHERE status = 'pending')::int AS pending,
            count(*) FILTER (WHERE status = 'leased')::int AS leased,
            count(*) FILTER (WHERE status = 'done' AND finished_at > now() - interval '1 hour')::int AS done_hour,
            count(*) FILTER (WHERE status = 'failed' AND finished_at > now() - interval '1 hour')::int AS failed_hour,
            count(*) FILTER (WHERE status = 'done' AND finished_at > now() - interval '1 hour' AND leased_workspace_id IS DISTINCT FROM workspace_id)::int AS shared_done_hour
     FROM fetch_tasks`,
  );
  const today = await db.get<{ completed: number; failed: number }>(
    "SELECT coalesce(sum(completed), 0)::int AS completed, coalesce(sum(failed), 0)::int AS failed FROM fetch_worker_daily WHERE day = current_date",
  );
  return {
    pending: row?.pending ?? 0,
    leased: row?.leased ?? 0,
    doneHour: row?.done_hour ?? 0,
    failedHour: row?.failed_hour ?? 0,
    sharedDoneHour: row?.shared_done_hour ?? 0,
    doneToday: today?.completed ?? 0,
    failedToday: today?.failed ?? 0,
  };
}
