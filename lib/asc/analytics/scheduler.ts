import { db, pool } from "@/lib/server/db";
import { syncAnalytics } from "./sync";

const TICK_MS = 10 * 60 * 1000;
const STARTUP_DELAY_MS = 2 * 60 * 1000;
const MAX_APPS_PER_TICK = 25;
const CONCURRENCY = 2;
const LOCK = 7321910;

type SchedulerState = { timer: ReturnType<typeof setInterval>; running: boolean };
type GlobalWithScheduler = typeof globalThis & { __openAsoStoreAnalyticsScheduler?: SchedulerState };

export async function dueApps(limit = MAX_APPS_PER_TICK) {
  return db.all<{ workspace_id: string; app_id: number }>(
    `SELECT a.workspace_id, a.id AS app_id FROM apps a
     LEFT JOIN asc_analytics_sync s ON s.workspace_id = a.workspace_id AND s.app_id = a.id
     WHERE a.asc_app_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM workspace_settings w WHERE w.workspace_id = a.workspace_id AND w.key = 'asc.privateKey' AND w.value IS NOT NULL AND w.value <> '')
       AND (s.next_check_at IS NULL OR s.next_check_at <= now())
     ORDER BY s.next_check_at ASC NULLS FIRST, a.id ASC LIMIT ?`,
    [limit],
  );
}

export async function runScheduledAnalyticsSync() {
  await db.ready();
  const client = await pool().connect();
  let locked = false;
  try {
    locked = (await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK])).rows[0]?.ok ?? false;
    if (!locked) return null;
    const queue = await dueApps();
    let synced = 0;
    let calls = 0;
    const worker = async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        try {
          const r = await syncAnalytics(job.workspace_id, job.app_id, { trigger: "scheduled" });
          calls += r.calls;
          if (r.instances > 0) synced++;
        } catch (error) {
          console.error(`[open-aso] store analytics sync failed for app ${job.app_id}`, error);
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    if (calls) console.info(`[open-aso] store analytics: ${synced} app(s) with new Apple data, ${calls} App Store Connect calls`);
    return { synced, calls };
  } finally {
    if (locked) await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => undefined);
    client.release();
  }
}

async function tick(state: SchedulerState) {
  if (state.running) return;
  state.running = true;
  try {
    await runScheduledAnalyticsSync();
  } catch (error) {
    console.error("[open-aso] store analytics scheduler failed", error);
  } finally {
    state.running = false;
  }
}

export function startStoreAnalyticsScheduler() {
  const g = globalThis as GlobalWithScheduler;
  if (g.__openAsoStoreAnalyticsScheduler) return;
  const state: SchedulerState = { timer: setInterval(() => void tick(state), TICK_MS), running: false };
  state.timer.unref?.();
  g.__openAsoStoreAnalyticsScheduler = state;
  setTimeout(() => void tick(state), STARTUP_DELAY_MS).unref?.();
}
