"use client";

import { FlaskConical, Loader2, TriangleAlert } from "lucide-react";
import Button from "@/components/_ui/button";
import Tag from "@/components/_ui/tag";
import { cn } from "@/lib/utils";

export function DemoBanner({ notice }: { notice: string | null }) {
  if (!notice) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-(--tag-amber-border) bg-(--tag-amber-bg) px-4 py-3">
      <span className="flex items-center gap-2 text-(--tag-amber-text)">
        <FlaskConical aria-hidden className="size-4 shrink-0" />
        <p>{notice}</p>
      </span>
      <Button variant="secondary" size="sm" href="/integrations">
        Set up integrations
      </Button>
    </div>
  );
}

export function LoadingBlock({ className }: { className?: string }) {
  return (
    <div className={cn("text-subtle flex min-h-[240px] items-center justify-center", className)}>
      <Loader2 aria-label="Loading" className="size-5 animate-spin" />
    </div>
  );
}

export function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="text-danger flex min-h-[200px] items-center justify-center gap-2">
      <TriangleAlert aria-hidden className="size-4" />
      <p>{message}</p>
    </div>
  );
}

export function Delta({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) {
  if (!previous) return <span className="caption-style text-subtle">no prior data</span>;
  const change = (current - previous) / Math.abs(previous);
  if (!Number.isFinite(change)) return null;
  const good = invert ? change < 0 : change > 0;
  return (
    <span className={cn("caption-style tabular-nums", Math.abs(change) < 0.005 ? "text-subtle" : good ? "text-trend" : "text-danger")}>
      {change > 0 ? "▲" : change < 0 ? "▼" : ""} {Math.abs(change * 100).toFixed(1)}%
      <span className="text-subtle"> vs prior</span>
    </span>
  );
}

export function KpiTile({ label, value, delta, hint }: { label: string; value: string; delta?: React.ReactNode; hint?: string }) {
  return (
    <div className="bg-card border-border flex min-w-0 flex-col gap-3 rounded-xl border p-4">
      <span className="eyebrow-style text-subtle truncate" title={hint}>
        {label}
      </span>
      <span className="text-[24px] leading-none font-medium tracking-tight tabular-nums">{value}</span>
      {delta}
    </div>
  );
}

export function MetricBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <span className="bg-track/60 block h-1.5 w-full min-w-16 overflow-hidden rounded-full">
      <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </span>
  );
}

export function RoasTag({ roas }: { roas: number | null }) {
  if (roas == null) return <span className="text-subtle">—</span>;
  const tone = roas >= 1 ? "green" : roas >= 0.5 ? "amber" : "red";
  return (
    <Tag tone={tone} size="sm" className="text-[12px] tabular-nums">
      {roas.toFixed(2)}×
    </Tag>
  );
}
