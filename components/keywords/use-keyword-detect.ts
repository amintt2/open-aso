"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { api, useApi } from "@/lib/client/api";
import type { DetectResult } from "@/lib/keywords/autodetect";
import type { PublicJob } from "@/lib/suggestions/jobs";

type DetectState = { job: PublicJob<DetectResult> | null; last: DetectResult | null };

export function useKeywordDetect(appId: number | undefined, country: string, onDone: () => void) {
  const url = appId ? `/api/apps/${appId}/keywords/detect?country=${country}` : null;
  const { data, mutate } = useApi<DetectState>(url, {
    refreshInterval: (latest) => (latest?.job?.status === "running" ? 1500 : 0),
    refreshWhenHidden: true,
  });
  const job = data?.job ?? null;
  const running = job?.status === "running";
  const seen = useRef<string | null>(null);

  useEffect(() => {
    if (!job || job.status === "running" || seen.current === job.id) return;
    seen.current = job.id;
    if (job.status === "error") toast.error(job.error ?? "Keyword detection failed");
    else if (job.result) {
      const n = job.result.added.length;
      toast.success(n ? `${n} keyword${n > 1 ? "s" : ""} detected and added` : "No new keywords found — your list already covers what this app ranks for");
    }
    onDone();
  }, [job, onDone]);

  async function start() {
    if (!appId) return;
    const res = await api<{ job: PublicJob<DetectResult> }>(`/api/apps/${appId}/keywords/detect`, { method: "POST", body: { country } });
    seen.current = null;
    await mutate({ job: res.job, last: data?.last ?? null }, { revalidate: true });
  }

  return { job, running, last: data?.last ?? null, start };
}
