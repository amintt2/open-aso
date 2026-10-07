"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, Loader2, Wand2, X } from "lucide-react";
import Button from "@/components/_ui/button";
import { COUNTRY_BY_CODE } from "@/lib/appstore/countries";
import type { MultiDetectResult } from "@/lib/keywords/autodetect";
import type { PublicJob } from "@/lib/suggestions/jobs";
import { cn } from "@/lib/utils";

export default function DetectBanner({ job, multi = false }: { job: PublicJob<unknown>; multi?: boolean }) {
  const pct = job.total ? Math.round((job.done / job.total) * 100) : 0;
  return (
    <div role="status" className="border-border bg-card flex shrink-0 items-center gap-3 border-b px-4 py-2.5">
      <span className="bg-primary/15 text-primary flex size-7 shrink-0 items-center justify-center rounded-lg">
        <Wand2 aria-hidden className="size-3.5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="caption-style text-foreground flex min-w-0 items-center gap-1.5">
          <Loader2 aria-hidden className="size-3 shrink-0 animate-spin" />
          <span className="line-clamp-2 sm:line-clamp-1">
            {multi ? "Detecting keywords across countries" : "Detecting your app's keywords"} · {job.stage}
          </span>
        </span>
        <span
          role="progressbar"
          aria-label="Detection progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="bg-track h-1 w-full max-w-[360px] overflow-hidden rounded-full"
        >
          <span className="bg-status block h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(6, pct)}%` }} />
        </span>
      </div>
      {multi && <span className="caption-style text-subtle shrink-0 tabular-nums">{pct}%</span>}
    </div>
  );
}

export function DetectSummary({ result, onDismiss }: { result: MultiDetectResult; onDismiss: () => void }) {
  const [open, setOpen] = useState(false);
  const failed = result.countries.filter((c) => c.error);
  const scanned = result.countries.length - failed.length;
  return (
    <div className="border-border bg-card flex shrink-0 flex-col border-b px-4 py-2.5">
      <div className="flex items-center gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-(--tag-yellow-bg) text-(--tag-yellow-text)">
          <AlertTriangle aria-hidden className="size-3.5" />
        </span>
        <div className="caption-style flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-foreground">
            {result.totalAdded} keyword{result.totalAdded === 1 ? "" : "s"} added · {scanned} countr{scanned === 1 ? "y" : "ies"} scanned
            {failed.length ? ` · ${failed.length} skipped` : ""}
          </span>
          {result.stoppedReason && <span className="text-warning">Stopped early: {result.stoppedReason}</span>}
        </div>
        {failed.length > 0 && (
          <Button variant="ghost" size="sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? "Hide" : "Details"}
            <ChevronDown aria-hidden className={cn("size-3.5 transition-transform duration-150", open && "rotate-180")} />
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" aria-label="Dismiss detection summary" onClick={onDismiss}>
          <X aria-hidden className="size-3.5" />
        </Button>
      </div>
      {open && failed.length > 0 && (
        <ul className="caption-style mt-2 flex max-h-[160px] flex-col gap-1 overflow-y-auto pl-10" aria-label="Countries that could not be scanned">
          {failed.map((c) => {
            const meta = COUNTRY_BY_CODE.get(c.country);
            return (
              <li key={c.country} className="flex gap-2">
                <span className="text-soft shrink-0">
                  {meta?.flag} {meta?.name ?? c.country.toUpperCase()}
                </span>
                <span className="text-subtle min-w-0 truncate" title={c.error ?? undefined}>
                  {c.error}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
