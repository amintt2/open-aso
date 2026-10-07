import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function JobProgress({ stage, done, total, detail, className }: { stage: string; done: number; total: number; detail?: string; className?: string }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className={cn("bg-card border-border flex flex-col gap-3 rounded-xl border p-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <Loader2 aria-hidden className="text-soft size-3.5 shrink-0 animate-spin" />
          <span className="truncate text-[14px]">{stage}</span>
        </span>
        <span className="caption-style text-subtle shrink-0 tabular-nums">{total > 0 ? `${done}/${total}` : "Preparing…"}</span>
      </div>
      <div role="progressbar" aria-label={stage} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="bg-track h-1.5 overflow-hidden rounded-full">
        <div className="bg-primary h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${Math.max(3, pct)}%` }} />
      </div>
      {detail && <p className="caption-style text-subtle">{detail}</p>}
    </div>
  );
}
