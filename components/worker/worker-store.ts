"use client";

import { useSyncExternalStore } from "react";

export type WorkerPhase = "starting" | "working" | "idle" | "standby" | "paused" | "limited" | "asleep" | "off";

export type WorkerSnapshot = {
  phase: WorkerPhase;
  today: number;
  limitedUntil: number;
  lastError: string | null;
};

const PAUSE_KEY = "open-aso:worker:paused";
const LIMIT_KEY = "open-aso:worker:limited-until";
const COUNT_PREFIX = "open-aso:worker:done:";

function read(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {}
}

function dayKey() {
  const d = new Date();
  return `${COUNT_PREFIX}${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

const SERVER: WorkerSnapshot = { phase: "off", today: 0, limitedUntil: 0, lastError: null };
let snapshot: WorkerSnapshot = SERVER;
const listeners = new Set<() => void>();

function emit(patch: Partial<WorkerSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  for (const l of listeners) l();
}

function syncFromStorage() {
  emit({ today: Number(read(dayKey()) ?? 0) || 0, limitedUntil: Number(read(LIMIT_KEY) ?? 0) || 0 });
}

let initialized = false;

function init() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  syncFromStorage();
  window.addEventListener("storage", (e) => {
    if (!e.key || e.key.startsWith(COUNT_PREFIX) || e.key === LIMIT_KEY || e.key === PAUSE_KEY) {
      syncFromStorage();
      for (const l of pauseListeners) l();
    }
  });
}

function subscribe(listener: () => void) {
  init();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useWorkerSnapshot() {
  return useSyncExternalStore(subscribe, () => snapshot, () => SERVER);
}

export function setPhase(phase: WorkerPhase, lastError?: string | null) {
  init();
  emit(lastError === undefined ? { phase } : { phase, lastError });
}

export function recordDone() {
  init();
  const key = dayKey();
  const next = (Number(read(key) ?? 0) || 0) + 1;
  write(key, String(next));
  emit({ today: next });
}

export function limitedUntil() {
  return Number(read(LIMIT_KEY) ?? 0) || 0;
}

export function setLimitedUntil(until: number) {
  write(LIMIT_KEY, until ? String(until) : null);
  emit({ limitedUntil: until });
}

const pauseListeners = new Set<() => void>();

export function isPaused() {
  return read(PAUSE_KEY) === "1";
}

export function setPaused(paused: boolean) {
  write(PAUSE_KEY, paused ? "1" : null);
  for (const l of pauseListeners) l();
}

function subscribePause(listener: () => void) {
  init();
  pauseListeners.add(listener);
  return () => pauseListeners.delete(listener);
}

export function onPauseChange(listener: () => void) {
  return subscribePause(listener);
}

export function usePaused() {
  return useSyncExternalStore(subscribePause, isPaused, () => false);
}
