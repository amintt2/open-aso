"use client";

import { useEffect, useRef } from "react";
import { useApi } from "@/lib/client/api";
import type { JobView } from "@/lib/suggestions/types";

export function useJob<T>(endpoint: string, jobId: string | null, onSettled: (job: JobView<T>) => void) {
  const { data } = useApi<JobView<T>>(jobId ? `${endpoint}/${jobId}` : null, {
    refreshInterval: (latest) => (latest && latest.status !== "running" ? 0 : 1000),
    dedupingInterval: 500,
    refreshWhenHidden: true,
  });
  const settled = useRef<string | null>(null);
  const callback = useRef(onSettled);
  useEffect(() => {
    callback.current = onSettled;
  });
  useEffect(() => {
    if (!data || data.status === "running" || settled.current === data.id) return;
    settled.current = data.id;
    callback.current(data);
  }, [data]);
  return data?.id === jobId ? data : undefined;
}
