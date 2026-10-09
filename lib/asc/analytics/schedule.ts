export type SyncWindow = { start: number; end: number };

const DAY_MS = 86400000;
const MINUTE_MS = 60000;
export const LEAD_MINUTES = 30;
export const HOURLY = 60;
export const BACKOFF = 150;
export const BACKOFF_AFTER = 3;

export function syncWindow(raw = process.env.OPEN_ASO_ASC_SYNC_WINDOW): SyncWindow {
  const m = raw?.trim().match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
  if (m) {
    const start = Number(m[1]);
    const end = Number(m[2]);
    if (start >= 0 && end <= 24 && start < end) return { start, end };
  }
  return { start: 8, end: 20 };
}

export function utcDay(t: number) {
  return new Date(t).toISOString().slice(0, 10);
}

export function addDays(day: string, n: number) {
  return utcDay(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS);
}

function at(day: string, minute: number) {
  return Date.parse(`${day}T00:00:00Z`) + minute * MINUTE_MS;
}

export function isUpToDate(state: { dataThrough: string | null; freshDay: string | null }, now: number) {
  const today = utcDay(now);
  return state.freshDay === today || (state.dataThrough != null && state.dataThrough >= addDays(today, -1));
}

export function firstCheckMinute(window: SyncWindow, publishMinute: number | null) {
  const open = window.start * 60;
  if (publishMinute == null) return open;
  return Math.min(Math.max(open, publishMinute - LEAD_MINUTES), window.end * 60 - LEAD_MINUTES);
}

export function jitterMinutes(seed: number) {
  return Math.abs(Math.imul(seed, 2654435761) >>> 0) % 10;
}

export function nextCheckAt(input: { now: number; upToDate: boolean; emptyChecksToday: number; publishMinute: number | null; window?: SyncWindow; jitter?: number }) {
  const window = input.window ?? syncWindow();
  const today = utcDay(input.now);
  const start = firstCheckMinute(window, input.publishMinute) + (input.jitter ?? 0);
  const tomorrowStart = at(addDays(today, 1), start);
  if (input.upToDate) return tomorrowStart;
  const todayStart = at(today, start);
  if (input.now < todayStart) return todayStart;
  const interval = input.emptyChecksToday >= BACKOFF_AFTER ? BACKOFF : HOURLY;
  const candidate = input.now + interval * MINUTE_MS;
  return candidate > at(today, window.end * 60) ? tomorrowStart : candidate;
}

export function medianMinute(minutes: number[]) {
  if (!minutes.length) return null;
  const sorted = [...minutes].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
