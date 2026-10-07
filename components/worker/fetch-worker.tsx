"use client";

import { useEffect } from "react";
import { isWorkerUrl, MAX_BODY_BYTES } from "@/lib/worker/urls";
import { isPaused, limitedUntil, onPauseChange, recordDone, setLimitedUntil, setPhase } from "./worker-store";

const LOCK = "open-aso-fetch-worker";
const MIN_GAP_MS = 4_000;
const FLOW_POLL_MS = 3_000;
const IDLE_POLL_MS = 10_000;
const HIDDEN_STOP_MS = 5 * 60_000;
const BACKOFF_MS = [60_000, 120_000, 300_000];
const LEASE_MAX = 2;
const FETCH_TIMEOUT_MS = 15_000;

type Task = { id: number; url: string };
type Outcome = { status: number; body?: string; error?: string };

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted || ms <= 0) return resolve();
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done, { once: true });
  });
}

function post(url: string, payload: unknown, signal?: AbortSignal, keepalive = false) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
    signal,
    keepalive,
  });
}

async function fetchFromApple(url: string): Promise<Outcome> {
  if (!isWorkerUrl(url)) return { status: 0, error: "URL not allowed" };
  try {
    const res = await fetch(url, {
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.status !== 200) return { status: res.status, error: `App Store responded ${res.status}` };
    const body = await res.text();
    if (body.length > MAX_BODY_BYTES) return { status: 0, error: "Response too large" };
    return { status: 200, body };
  } catch (error) {
    return { status: 0, error: error instanceof Error ? error.message.slice(0, 200) : "Network error" };
  }
}

export default function FetchWorker() {
  useEffect(() => {
    const sessionId = crypto.randomUUID();
    let run: AbortController | null = null;
    let hiddenTimer: ReturnType<typeof setTimeout> | undefined;
    let strikes = 0;
    let networkErrors = 0;
    let lastFetchAt = 0;

    const leave = () => {
      post("/api/worker/lease", { sessionId, leave: true }, undefined, true).catch(() => undefined);
    };

    const backOff = () => {
      const wait = BACKOFF_MS[Math.min(strikes, BACKOFF_MS.length - 1)];
      strikes++;
      setLimitedUntil(Date.now() + wait);
    };

    async function complete(task: Task, outcome: Outcome, signal: AbortSignal) {
      try {
        const res = await post("/api/worker/complete", { sessionId, id: task.id, ...outcome }, signal);
        if (!res.ok) return;
        const data = (await res.json()) as { outcome?: string };
        if (data.outcome === "done") recordDone();
      } catch {}
    }

    async function loop(signal: AbortSignal) {
      setPhase("starting");
      let announcedLimit = false;
      while (!signal.aborted) {
        if (isPaused()) return setPhase("paused");
        const until = limitedUntil();
        if (until > Date.now()) {
          setPhase("limited", "Apple is rate limiting this browser");
          if (!announcedLimit) leave();
          announcedLimit = true;
          await sleep(Math.min(until - Date.now(), 30_000), signal);
          continue;
        }
        announcedLimit = false;
        let tasks: Task[] = [];
        try {
          const res = await post("/api/worker/lease", { sessionId, shared: true, max: LEASE_MAX }, signal);
          if (res.status === 401 || res.status === 403) return setPhase("off");
          if (res.ok) tasks = ((await res.json()) as { tasks?: Task[] }).tasks ?? [];
        } catch {
          if (signal.aborted) return;
        }
        setPhase(tasks.length ? "working" : "idle");
        for (const task of tasks) {
          if (signal.aborted) return;
          if (limitedUntil() > Date.now()) {
            await complete(task, { status: 0, error: "Browser paused after an App Store rate limit" }, signal);
            continue;
          }
          await sleep(lastFetchAt + MIN_GAP_MS - Date.now(), signal);
          if (signal.aborted) return;
          lastFetchAt = Date.now();
          const outcome = await fetchFromApple(task.url);
          if (outcome.status === 403 || outcome.status === 429) backOff();
          else if (outcome.status === 0 && outcome.error !== "URL not allowed" && outcome.error !== "Response too large") {
            networkErrors++;
            if (networkErrors >= 2) backOff();
          } else if (outcome.status === 200) {
            strikes = 0;
            networkErrors = 0;
          }
          if (outcome.status !== 200) setPhase("working", outcome.error ?? null);
          await complete(task, outcome, signal);
        }
        await sleep(tasks.length ? FLOW_POLL_MS : IDLE_POLL_MS, signal);
      }
    }

    function start() {
      if (run) return;
      if (isPaused()) return setPhase("paused");
      const ctrl = new AbortController();
      run = ctrl;
      const finish = () => {
        if (run === ctrl) run = null;
        leave();
      };
      if (typeof navigator !== "undefined" && navigator.locks) {
        setPhase("standby");
        navigator.locks
          .request(LOCK, { signal: ctrl.signal }, () => loop(ctrl.signal))
          .catch(() => undefined)
          .finally(finish);
      } else {
        loop(ctrl.signal).finally(finish);
      }
    }

    function stop(phase: "paused" | "asleep" | "off") {
      run?.abort();
      run = null;
      leave();
      setPhase(phase);
    }

    const onVisibility = () => {
      clearTimeout(hiddenTimer);
      if (document.visibilityState === "hidden") hiddenTimer = setTimeout(() => stop("asleep"), HIDDEN_STOP_MS);
      else start();
    };
    const offPause = onPauseChange(() => (isPaused() ? stop("paused") : start()));
    const onPageHide = () => leave();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    start();
    if (document.visibilityState === "hidden") hiddenTimer = setTimeout(() => stop("asleep"), HIDDEN_STOP_MS);

    return () => {
      clearTimeout(hiddenTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      offPause();
      stop("off");
    };
  }, []);

  return null;
}
