"use client";

import { Loader2, Wand2 } from "lucide-react";
import type { DetectResult } from "@/lib/keywords/autodetect";
import type { PublicJob } from "@/lib/suggestions/jobs";

export default function DetectBanner({ job }: { job: PublicJob<DetectResult> }) {
  const pct = job.total ? Math.round((job.done / job.total) * 100) : 0;
  return (
    <div role="status" className="border-border bg-card flex shrink-0 items-center gap-3 border-b px-4 py-2.5">
      <span className="bg-primary/15 text-primary flex size-7 shrink-0 items-center justify-center rounded-lg">
        <Wand2 aria-hidden className="size-3.5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="caption-style text-foreground flex items-center gap-1.5">
          <Loader2 aria-hidden className="size-3 animate-spin" />
          Detecting your app&apos;s keywords · {job.stage}
        </span>
        <span className="bg-track h-1 w-full max-w-[360px] overflow-hidden rounded-full">
          <span className="bg-status block h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(6, pct)}%` }} />
        </span>
      </div>
    </div>
  );
}
