import { refreshKeywords } from "@/lib/aso/keywords";
import { db, pool } from "@/lib/server/db";

const INTERVAL_MS = 30 * 60 * 1000;
const STARTUP_DELAY_MS = 90 * 1000;
const MAX_AGE_HOURS = 20;
const MAX_PAIRS_PER_RUN = 150;
const MAX_IDS_PER_RUN = 1500;
const CONCURRENCY = 2;
const LOCK = 7321902;

type SchedulerState = {
  timer: ReturnType<typeof setInterval>;
  running: boolean;
};
type GlobalWithScheduler = typeof globalThis & {
  __openAsoKeywordScheduler?: SchedulerState;
};

export async function staleKeywordBatch(maxAgeHours = MAX_AGE_HOURS, maxPairs = MAX_PAIRS_PER_RUN, maxIds = MAX_IDS_PER_RUN) {
  const rows = await db.all<{ id: number }>(
    `WITH stale AS (
       SELECT id, term, country, coalesce(last_refreshed_at, '-infinity'::timestamptz) AS refreshed FROM keywords
       WHERE last_refreshed_at IS NULL OR last_refreshed_at < now() - make_interval(hours => ?)
     ), pairs AS (
       SELECT term, country, min(refreshed) AS oldest FROM stale GROUP BY term, country ORDER BY oldest ASC LIMIT ?
     )
     SELECT s.id FROM stale s JOIN pairs p ON p.term = s.term AND p.country = s.country
     ORDER BY p.oldest ASC, s.country, s.term, s.id LIMIT ?`,
    [maxAgeHours, maxPairs, maxIds],
  );
  return rows.map((r) => r.id);
}

export async function runScheduledRefresh() {
  await db.ready();
  const client = await pool().connect();
  let locked = false;
  try {
    locked = (await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK])).rows[0]?.ok ?? false;
    if (!locked) return null;
    const ids = await staleKeywordBatch();
    if (!ids.length) return { refreshed: 0, failed: 0 };
    const results = await refreshKeywords(null, ids, CONCURRENCY);
    const failed = results.filter((r) => !r.ok).length;
    console.info(`[open-aso] refreshed ${results.length - failed}/${results.length} stale keywords`);
    return { refreshed: results.length - failed, failed };
  } finally {
    if (locked) await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => undefined);
    client.release();
  }
}

async function tick(state: SchedulerState) {
  if (state.running) return;
  state.running = true;
  try {
    await runScheduledRefresh();
  } catch (error) {
    console.error("[open-aso] keyword refresh failed", error);
  } finally {
    state.running = false;
  }
}

export function startKeywordScheduler() {
  const g = globalThis as GlobalWithScheduler;
  if (g.__openAsoKeywordScheduler) return;
  const state: SchedulerState = {
    timer: setInterval(() => void tick(state), INTERVAL_MS),
    running: false,
  };
  state.timer.unref?.();
  g.__openAsoKeywordScheduler = state;
  setTimeout(() => void tick(state), STARTUP_DELAY_MS).unref?.();
}
