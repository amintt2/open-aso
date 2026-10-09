"use client";

import type { Period } from "@/lib/asc/analytics/types";
import { cn } from "@/lib/utils";

export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { key: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="bg-secondary flex h-[30px] max-w-full min-w-0 items-center overflow-x-auto rounded-full p-0.5 [scrollbar-width:none] shadow-[0px_0px_0px_1px_rgba(0,0,0,0.4),inset_0px_1px_0px_0px_rgba(255,255,255,0.1)]">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "caption-style ease-power3-out focus-visible:ring-ring/60 h-full shrink-0 cursor-pointer rounded-full px-3 whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-2",
            value === o.key ? "bg-muted text-foreground" : "text-subtle hover:text-soft",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function change(p: Period | null | undefined) {
  if (!p || p.previous == null || p.previous === 0) return null;
  return (p.current - p.previous) / Math.abs(p.previous);
}

export function DeltaText({ period, suffix = "vs prior period", points = false }: { period: Period | null | undefined; suffix?: string; points?: boolean }) {
  if (!period || period.previous == null) return <span className="caption-style text-subtle truncate">no prior data</span>;
  const value = points ? (period.current - period.previous) * 100 : change(period);
  if (value == null) return <span className="caption-style text-subtle truncate">none in the prior period</span>;
  const flat = points ? Math.abs(value) < 0.05 : Math.abs(value) < 0.005;
  return (
    <span className={cn("caption-style truncate tabular-nums", flat ? "text-subtle" : value > 0 ? "text-trend" : "text-danger")}>
      {value > 0 ? "▲" : value < 0 ? "▼" : ""} {points ? `${Math.abs(value).toFixed(2)} pts` : `${Math.abs(value * 100).toFixed(1)}%`}
      <span className="text-subtle"> {suffix}</span>
    </span>
  );
}

export function SmallDelta({ current, previous }: { current: number; previous: number | null }) {
  if (previous == null || previous === 0) return <span className="text-subtle">—</span>;
  const c = (current - previous) / previous;
  return <span className={cn("tabular-nums", Math.abs(c) < 0.005 ? "text-subtle" : c > 0 ? "text-trend" : "text-danger")}>{`${c > 0 ? "+" : ""}${(c * 100).toFixed(0)}%`}</span>;
}
