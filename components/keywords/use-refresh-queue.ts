"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/client/api";

const BATCH_SIZE = 5;

type RefreshResponse = {
  results: { id: number; ok: boolean; error?: string }[];
  failed: number;
};
export type RefreshProgress = { done: number; total: number; failed: number };

const IDLE: RefreshProgress = { done: 0, total: 0, failed: 0 };

export function useRefreshQueue(onBatch: () => Promise<unknown> | void) {
  const queue = useRef<number[]>([]);
  const tracked = useRef(new Set<number>());
  const running = useRef(false);
  const callback = useRef(onBatch);
  const [refreshing, setRefreshing] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const [progress, setProgress] = useState<RefreshProgress>(IDLE);

  useEffect(() => {
    callback.current = onBatch;
  });

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    let failed = 0;
    let done = 0;
    while (queue.current.length) {
      const batch = queue.current.splice(0, BATCH_SIZE);
      let batchFailed = 0;
      try {
        const res = await api<RefreshResponse>("/api/keywords/refresh", {
          method: "POST",
          body: { ids: batch },
        });
        batchFailed = res.failed;
      } catch {
        batchFailed = batch.length;
      }
      failed += batchFailed;
      done += batch.length;
      batch.forEach((id) => tracked.current.delete(id));
      setRefreshing(new Set(tracked.current));
      setProgress((p) => ({
        ...p,
        done: p.done + batch.length,
        failed: p.failed + batchFailed,
      }));
      await callback.current();
    }
    running.current = false;
    setProgress(IDLE);
    if (failed)
      toast.error(`${failed} of ${done} keywords could not be refreshed`);
    else if (done > 1) toast.success(`${done} keywords refreshed`);
  }, []);

  const enqueue = useCallback(
    (ids: number[]) => {
      const fresh = ids.filter((id) => !tracked.current.has(id));
      if (!fresh.length) return 0;
      fresh.forEach((id) => tracked.current.add(id));
      queue.current.push(...fresh);
      setRefreshing(new Set(tracked.current));
      setProgress((p) => ({ ...p, total: p.total + fresh.length }));
      void run();
      return fresh.length;
    },
    [run],
  );

  return { refreshing, progress, enqueue, busy: progress.total > 0 };
}
