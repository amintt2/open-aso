import { refreshKeywords, staleKeywordIds } from "@/lib/aso/keywords";

const INTERVAL_MS = 30 * 60 * 1000;
const STARTUP_DELAY_MS = 90 * 1000;
const MAX_AGE_HOURS = 20;
const MAX_PER_RUN = 150;
const CONCURRENCY = 2;

type SchedulerState = {
  timer: ReturnType<typeof setInterval>;
  running: boolean;
};
type GlobalWithScheduler = typeof globalThis & {
  __openAsoKeywordScheduler?: SchedulerState;
};

async function tick(state: SchedulerState) {
  if (state.running) return;
  state.running = true;
  try {
    const ids = staleKeywordIds(MAX_AGE_HOURS).slice(0, MAX_PER_RUN);
    if (!ids.length) return;
    const results = await refreshKeywords(ids, CONCURRENCY);
    const failed = results.filter((r) => !r.ok).length;
    console.info(
      `[open-aso] refreshed ${results.length - failed}/${results.length} stale keywords`,
    );
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
