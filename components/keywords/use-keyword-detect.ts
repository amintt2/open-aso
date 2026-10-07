"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { mutate as mutateCache } from "swr";
import { api, useApi } from "@/lib/client/api";
import type { DetectResult, MultiDetectResult } from "@/lib/keywords/autodetect";
import type { PublicJob } from "@/lib/suggestions/jobs";

export type DetectScope = "country" | "tracked" | "top" | "all";

type JobResponse<R> = { job: PublicJob<R> | null };

function useJobPoll<R>(base: string | null) {
  const [jobId, setJobId] = useState<string | null>(null);
  const keyFor = (id: string | null) => (base ? `${base}${id ? `&jobId=${id}` : ""}` : null);
  const { data } = useApi<JobResponse<R>>(keyFor(jobId), {
    refreshInterval: (latest) => (latest?.job?.status === "running" ? 1500 : 0),
    refreshWhenHidden: true,
    keepPreviousData: true,
    onSuccess: (d) => {
      if (d.job?.status === "running" && d.job.id !== jobId) setJobId(d.job.id);
    },
  });

  async function track(job: PublicJob<R>) {
    const key = keyFor(job.id);
    if (key) await mutateCache(key, { job }, { revalidate: false });
    setJobId(job.id);
  }

  return { job: data?.job ?? null, track };
}

function errorMessage(e: unknown, fallback: string) {
  return e instanceof Error && e.message ? e.message : fallback;
}

export function useKeywordDetect(appId: number | undefined, country: string, onDone: () => void) {
  const router = useRouter();
  const single = useJobPoll<DetectResult>(appId ? `/api/apps/${appId}/keywords/detect?country=${country}` : null);
  const multi = useJobPoll<MultiDetectResult>(appId ? `/api/apps/${appId}/keywords/detect?scope=multi` : null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const seen = useRef(new Set<string>());
  const done = useRef(onDone);

  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    function warnAsc(result: DetectResult) {
      const asc = result.appStoreConnect;
      if (!asc || asc === "used" || !appId) return;
      const reason =
        asc === "not-connected"
          ? "App Store Connect isn't connected, so your keyword field wasn't included."
          : asc === "not-linked"
            ? "This app isn't linked to App Store Connect, so your keyword field wasn't included."
            : `App Store Connect couldn't be read: ${result.appStoreConnectMessage ?? "unknown error"}`;
      toast.warning(reason, {
        duration: 12000,
        action: { label: "Connect", onClick: () => router.push(`/apps/${appId}/page`) },
      });
    }

    const s = single.job;
    if (s && s.status !== "running" && !seen.current.has(s.id)) {
      seen.current.add(s.id);
      if (s.status === "error") toast.error(s.error ?? "Keyword detection failed");
      else if (s.result) {
        const n = s.result.added.length;
        toast.success(n ? `${n} keyword${n > 1 ? "s" : ""} detected and added` : "No new keywords found — your list already covers what this app ranks for");
        warnAsc(s.result);
      }
      done.current();
    }

    const m = multi.job;
    if (m && m.status !== "running" && !seen.current.has(m.id)) {
      seen.current.add(m.id);
      if (m.status === "error") toast.error(m.error ?? "Keyword detection failed");
      else if (m.result) {
        const r = m.result;
        const withAdds = r.countries.filter((c) => c.added > 0).length;
        const scanned = r.countries.filter((c) => !c.error).length;
        toast.success(
          r.totalAdded
            ? `${r.totalAdded} keyword${r.totalAdded > 1 ? "s" : ""} added across ${withAdds} countr${withAdds === 1 ? "y" : "ies"} — scoring continues in the background`
            : `No new keywords found across ${scanned} countr${scanned === 1 ? "y" : "ies"}`,
        );
        if (r.stoppedReason) toast.warning(`Detection stopped early: ${r.stoppedReason}`, { duration: 12000 });
        warnAsc(r);
      }
      done.current();
    }
  }, [single.job, multi.job, appId, router]);

  async function start(scope: DetectScope) {
    if (!appId || starting) return;
    setStarting(true);
    try {
      const res = await api<{ job: PublicJob<DetectResult | MultiDetectResult> }>(`/api/apps/${appId}/keywords/detect`, {
        method: "POST",
        body: scope === "country" ? { country } : { scope },
      });
      if (scope === "country") await single.track(res.job as PublicJob<DetectResult>);
      else await multi.track(res.job as PublicJob<MultiDetectResult>);
    } catch (e) {
      toast.error(errorMessage(e, "Could not start keyword detection"));
    } finally {
      setStarting(false);
    }
  }

  const multiResult = multi.job?.status === "done" ? (multi.job.result ?? null) : null;
  const summary =
    multiResult && multi.job?.id !== dismissed && (multiResult.stoppedReason || multiResult.countries.some((c) => c.error)) ? multiResult : null;
  const runningJob = multi.job?.status === "running" ? multi.job : single.job?.status === "running" ? single.job : null;

  return {
    job: runningJob,
    multi: runningJob != null && runningJob === multi.job,
    running: runningJob != null || starting,
    summary,
    multiWindow: multi.job && multi.job.status !== "error" ? { from: multi.job.startedAt, to: multi.job.finishedAt ?? null } : null,
    dismissSummary: () => setDismissed(multi.job?.id ?? null),
    start,
  };
}
